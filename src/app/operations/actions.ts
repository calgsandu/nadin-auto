"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canCreateSales, canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  calculateNextQuantity,
  validateDifferentWarehouses,
  validateSaleAvailability,
} from "@/lib/operations/inventory";
import {
  calculateReceiptTotalLei,
  parseReceiptLines,
} from "@/lib/operations/receipt-lines";
import { parseTransferLines } from "@/lib/operations/transfer-lines";
import {
  calculateSaleTotalEuro,
  parseSaleLines,
} from "@/lib/operations/sales";
import { aggregateRestockRequests } from "@/lib/operations/restock";
import {
  ensureCustomerPartner,
  ensureSupplierPartner,
  normalizeOptionalPartnerId,
} from "@/lib/operations/supplier-selection";

export type OperationActionState = {
  ok: boolean;
  message: string;
};

const initialError: OperationActionState = {
  ok: false,
  message: "Documentul nu a putut fi salvat.",
};

export async function createReceiptAction(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  try {
    const user = await requireOperationsWrite();
    const warehouseId = readString(formData, "warehouseId");
    const documentDate = readDate(formData, "documentDate");
    const selectedPartnerId = normalizeOptionalPartnerId(readString(formData, "partnerId"));
    const notes = readString(formData, "notes");
    const lines = parseReceiptLines({
      productIds: readStrings(formData, "productId"),
      quantities: readStrings(formData, "quantity"),
      unitCostsLei: readStrings(formData, "unitCostLei"),
    });

    if (!warehouseId) {
      throw new Error("Alege locația.");
    }

    await prisma.$transaction(async (tx) => {
      const partner = selectedPartnerId
        ? await tx.partner.findUnique({
            where: { id: selectedPartnerId },
            select: { id: true, kind: true },
          })
        : null;
      const partnerId = ensureSupplierPartner(partner, selectedPartnerId);
      const number = await nextDocumentNumber(tx, "RECEIPT");
      const document = await tx.stockDocument.create({
        data: {
          type: "RECEIPT",
          number,
          documentDate,
          warehouseId,
          partnerId,
          notes,
          totalLei: calculateReceiptTotalLei(lines),
          lines: {
            create: lines,
          },
        },
        include: {
          warehouse: { select: { name: true } },
          partner: { select: { name: true } },
        },
      });

      for (const line of lines) {
        await updateWarehouseStock(tx, {
          productId: line.productId,
          warehouseId,
          quantity: line.quantity,
          kind: "RECEIPT",
        });
        await syncProductAggregateStock(tx, line.productId);
      }

      await logAudit(tx, user, {
        action: "CREATE",
        entity: "StockDocument",
        entityId: document.id,
        summary: `Recepție #${document.number} creată (${lines.length} produse, ${Number(document.totalLei ?? 0)} lei) — ${document.warehouse.name}${document.partner ? `, furnizor ${document.partner.name}` : ""}`,
        details: { lines },
      });

      return document;
    });

    revalidatePath("/");
    return {
      ok: true,
      message: `Recepția a fost salvată cu ${lines.length} produse.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createTransferAction(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  try {
    const user = await requireOperationsWrite();
    const sourceWarehouseId = readString(formData, "sourceWarehouseId");
    const destinationWarehouseId = readString(formData, "destinationWarehouseId");
    const documentDate = readDate(formData, "documentDate");
    const notes = readString(formData, "notes");
    const lines = parseTransferLines({
      productIds: readStrings(formData, "productId"),
      quantities: readStrings(formData, "quantity"),
    });

    validateDifferentWarehouses(sourceWarehouseId, destinationWarehouseId);

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const sourceStock = await ensureWarehouseStockRow(
          tx,
          line.productId,
          sourceWarehouseId,
        );
        validateSaleAvailability(sourceStock.quantity, line.quantity);
      }

      const firstNumber = await nextDocumentNumber(tx, "ADJUSTMENT");
      const transferNote = notes ? `Transfer: ${notes}` : "Transfer între locații";
      // Jumătățile de transfer se leagă între ele: se șterg doar împreună.
      const transferGroupId = randomUUID();

      await tx.stockDocument.create({
        data: {
          type: "ADJUSTMENT",
          number: firstNumber,
          documentDate,
          warehouseId: sourceWarehouseId,
          transferGroupId,
          notes: `${transferNote}. Ieșire către locația destinație.`,
          lines: {
            create: lines.map((line) => ({
              productId: line.productId,
              quantity: -line.quantity,
            })),
          },
        },
      });
      await tx.stockDocument.create({
        data: {
          type: "ADJUSTMENT",
          number: firstNumber + 1,
          documentDate,
          warehouseId: destinationWarehouseId,
          transferGroupId,
          notes: `${transferNote}. Intrare din locația sursă.`,
          lines: {
            create: lines,
          },
        },
      });

      for (const line of lines) {
        await updateWarehouseStock(tx, {
          productId: line.productId,
          warehouseId: sourceWarehouseId,
          quantity: -line.quantity,
          kind: "ADJUSTMENT",
        });
        await updateWarehouseStock(tx, {
          productId: line.productId,
          warehouseId: destinationWarehouseId,
          quantity: line.quantity,
          kind: "ADJUSTMENT",
        });
        await syncProductAggregateStock(tx, line.productId);
      }

      const warehouseNames = await tx.warehouse.findMany({
        where: { id: { in: [sourceWarehouseId, destinationWarehouseId] } },
        select: { id: true, name: true },
      });
      const nameOf = (id: string) => warehouseNames.find((w) => w.id === id)?.name ?? id;
      await logAudit(tx, user, {
        action: "CREATE",
        entity: "StockDocument",
        summary: `Transfer #${firstNumber}/#${firstNumber + 1} creat (${lines.length} produse): ${nameOf(sourceWarehouseId)} → ${nameOf(destinationWarehouseId)}`,
        details: { lines },
      });
    });

    revalidatePath("/");
    return {
      ok: true,
      message: `Transferul a fost salvat cu ${lines.length} produse.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createSaleAction(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  try {
    const user = await requireSalesWrite();
    const warehouseId = readString(formData, "warehouseId");
    const documentDate = readDate(formData, "documentDate");
    const selectedPartnerId = normalizeOptionalPartnerId(readString(formData, "partnerId"));
    const newCustomerName = readString(formData, "newCustomerName");
    const notes = readString(formData, "notes");
    const lines = parseSaleLines({
      productIds: readStrings(formData, "productId"),
      quantities: readStrings(formData, "quantity"),
      unitPricesEuro: readStrings(formData, "unitPriceEuro"),
    });

    if (!warehouseId) {
      throw new Error("Alege locația.");
    }

    await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
        select: { name: true },
      });

      if (!warehouse) {
        throw new Error("Locația aleasă nu există.");
      }

      let partnerId: string | null;
      if (newCustomerName) {
        const existing = await tx.partner.findUnique({
          where: { name: newCustomerName },
          select: { id: true, kind: true },
        });
        if (existing) {
          if (existing.kind === "SUPPLIER") {
            await tx.partner.update({
              where: { id: existing.id },
              data: { kind: "BOTH" },
            });
          }
          partnerId = existing.id;
        } else {
          const created = await tx.partner.create({
            data: { name: newCustomerName, kind: "CUSTOMER" },
            select: { id: true },
          });
          partnerId = created.id;
        }
      } else {
        const partner = selectedPartnerId
          ? await tx.partner.findUnique({
              where: { id: selectedPartnerId },
              select: { id: true, kind: true },
            })
          : null;
        partnerId = ensureCustomerPartner(partner, selectedPartnerId);
      }

      for (const line of lines) {
        const stock = await ensureWarehouseStockRow(tx, line.productId, warehouseId);
        validateSaleAvailability(stock.quantity, line.quantity);
      }

      const document = await tx.stockDocument.create({
        data: {
          type: "SALE",
          number: await nextDocumentNumber(tx, "SALE"),
          documentDate,
          warehouseId,
          partnerId,
          notes,
          // Sales are priced in lei (MDL); the per-line value carries lei.
          totalLei: calculateSaleTotalEuro(lines),
          lines: {
            create: lines,
          },
        },
      });

      if (warehouse.name === RESTOCK_WAREHOUSE_NAME) {
        await tx.restockTask.createMany({
          data: aggregateRestockRequests(lines).map((line) => ({
            productId: line.productId,
            warehouseId,
            sourceDocumentId: document.id,
            quantity: line.quantity,
            requestedAt: documentDate,
          })),
        });
      }

      for (const line of lines) {
        await updateWarehouseStock(tx, {
          productId: line.productId,
          warehouseId,
          quantity: line.quantity,
          kind: "SALE",
        });
        await syncProductAggregateStock(tx, line.productId);
      }

      await logAudit(tx, user, {
        action: "CREATE",
        entity: "StockDocument",
        entityId: document.id,
        summary: `Vânzare #${document.number} creată (${lines.length} produse, ${Number(document.totalLei ?? 0)} lei) — ${warehouse.name}`,
        details: { lines },
      });
    });

    revalidatePath("/");
    return {
      ok: true,
      message: `Vânzarea a fost salvată cu ${lines.length} produse.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createReturnAction(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  try {
    const user = await requireOperationsWrite();
    const saleDocumentId = readString(formData, "saleDocumentId");
    const documentDate = readDate(formData, "documentDate");
    const notes = readString(formData, "notes");
    const productIds = readStrings(formData, "productId");
    const quantities = readStrings(formData, "quantity");

    if (!saleDocumentId) {
      throw new Error("Alege vânzarea pentru retur.");
    }

    const lines = productIds
      .map((productId, index) => ({
        productId: productId.trim(),
        quantity: Number(quantities[index] ?? ""),
      }))
      .filter((line) => line.productId && line.quantity > 0);

    if (lines.length === 0) {
      throw new Error("Alege cel puțin un produs cu cantitate pentru retur.");
    }

    await prisma.$transaction(async (tx) => {
      const sale = await tx.stockDocument.findUnique({
        where: { id: saleDocumentId },
        include: { lines: true },
      });

      if (!sale || sale.type !== "SALE") {
        throw new Error("Vânzarea aleasă nu există.");
      }

      const soldByProduct = new Map(
        sale.lines.map((line) => [line.productId, line]),
      );

      // Retururile anterioare pe aceeași vânzare se cumulează — nu se poate
      // returna mai mult decât s-a vândut, indiferent în câte documente.
      const priorReturnLines = await tx.stockDocumentLine.findMany({
        where: { document: { type: "RETURN", sourceDocumentId: sale.id } },
        select: { productId: true, quantity: true },
      });
      const alreadyReturned = new Map<string, number>();
      for (const line of priorReturnLines) {
        alreadyReturned.set(
          line.productId,
          (alreadyReturned.get(line.productId) ?? 0) + line.quantity,
        );
      }

      let totalLei = 0;
      const returnLines = lines.map((line) => {
        const sold = soldByProduct.get(line.productId);
        if (!sold) {
          throw new Error("Produsul ales nu face parte din vânzarea selectată.");
        }
        const remaining = sold.quantity - (alreadyReturned.get(line.productId) ?? 0);
        if (!Number.isInteger(line.quantity) || line.quantity > remaining) {
          throw new Error(
            `Cantitatea returnată depășește ce a rămas de returnat (${Math.max(remaining, 0)} din ${sold.quantity} vândute).`,
          );
        }
        const unit = Number(sold.unitPriceEuro ?? 0);
        totalLei += unit * line.quantity;
        return {
          productId: line.productId,
          quantity: line.quantity,
          unitPriceEuro: sold.unitPriceEuro,
        };
      });

      const returnDoc = await tx.stockDocument.create({
        data: {
          type: "RETURN",
          number: await nextDocumentNumber(tx, "RETURN"),
          documentDate,
          warehouseId: sale.warehouseId,
          partnerId: sale.partnerId,
          sourceDocumentId: sale.id,
          notes: notes
            ? `Retur pentru Vânzare #${sale.number}. ${notes}`
            : `Retur pentru Vânzare #${sale.number}`,
          totalLei,
          lines: { create: returnLines },
        },
      });

      await logAudit(tx, user, {
        action: "CREATE",
        entity: "StockDocument",
        entityId: returnDoc.id,
        summary: `Retur #${returnDoc.number} creat pentru Vânzare #${sale.number} (${returnLines.length} produse, ${totalLei} lei)`,
        details: { lines: returnLines.map((l) => ({ productId: l.productId, quantity: l.quantity, price: Number(l.unitPriceEuro ?? 0) })) },
      });

      for (const line of returnLines) {
        await updateWarehouseStock(tx, {
          productId: line.productId,
          warehouseId: sale.warehouseId,
          quantity: line.quantity,
          kind: "RETURN",
        });
        await syncProductAggregateStock(tx, line.productId);

        // The product came back, so it no longer needs restocking in 110A:
        // shrink (or drop) the pending task created by the source sale.
        const task = await tx.restockTask.findFirst({
          where: {
            sourceDocumentId: sale.id,
            productId: line.productId,
            status: "PENDING",
          },
        });
        if (task) {
          const remaining = task.quantity - line.quantity;
          if (remaining > 0) {
            await tx.restockTask.update({
              where: { id: task.id },
              data: { quantity: remaining },
            });
          } else {
            await tx.restockTask.delete({ where: { id: task.id } });
          }
        }
      }
    });

    revalidatePath("/");
    return {
      ok: true,
      message: `Returul a fost salvat cu ${lines.length} produse.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createInventoryAction(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  try {
    const user = await requireOperationsWrite();
    const warehouseId = readString(formData, "warehouseId");
    const documentDate = readDate(formData, "documentDate");
    const notes = readString(formData, "notes");
    const productIds = readStrings(formData, "productId");
    const countedValues = readStrings(formData, "countedQuantity");

    if (!warehouseId) {
      throw new Error("Alege depozitul inventariat.");
    }

    const seen = new Set<string>();
    const lines = productIds.map((rawProductId, index) => {
      const productId = rawProductId.trim();
      const counted = Number(countedValues[index] ?? "");
      if (!productId) {
        throw new Error(`Alege produsul de pe poziția ${index + 1}.`);
      }
      if (seen.has(productId)) {
        throw new Error(`Produsul de pe poziția ${index + 1} este adăugat de mai multe ori.`);
      }
      if (!Number.isInteger(counted) || counted < 0) {
        throw new Error(`Cantitatea numărată de pe poziția ${index + 1} nu este validă.`);
      }
      seen.add(productId);
      return { productId, counted };
    });

    if (lines.length === 0) {
      throw new Error("Adaugă cel puțin un produs numărat.");
    }

    let adjustedCount = 0;
    await prisma.$transaction(async (tx) => {
      const diffs: { productId: string; quantity: number }[] = [];
      for (const line of lines) {
        const stock = await ensureWarehouseStockRow(tx, line.productId, warehouseId);
        const diff = line.counted - stock.quantity;
        if (diff !== 0) {
          diffs.push({ productId: line.productId, quantity: diff });
        }
      }

      if (diffs.length === 0) {
        throw new Error("Stocul numărat coincide cu cel din sistem — nimic de ajustat.");
      }

      const inventoryDoc = await tx.stockDocument.create({
        data: {
          type: "ADJUSTMENT",
          number: await nextDocumentNumber(tx, "ADJUSTMENT"),
          documentDate,
          warehouseId,
          notes: notes ? `Inventar: ${notes}` : "Inventar",
          lines: { create: diffs },
        },
        include: { warehouse: { select: { name: true } } },
      });

      await logAudit(tx, user, {
        action: "CREATE",
        entity: "StockDocument",
        entityId: inventoryDoc.id,
        summary: `Inventar #${inventoryDoc.number} salvat (${diffs.length} poziții ajustate) — ${inventoryDoc.warehouse.name}`,
        details: { diffs },
      });

      for (const diff of diffs) {
        await updateWarehouseStock(tx, {
          productId: diff.productId,
          warehouseId,
          quantity: diff.quantity,
          kind: "ADJUSTMENT",
        });
        await syncProductAggregateStock(tx, diff.productId);
      }
      adjustedCount = diffs.length;
    });

    revalidatePath("/");
    return {
      ok: true,
      message: `Inventarul a fost salvat: ${adjustedCount} poziții ajustate.`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function markRestockDeliveredAction(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  return markRestockTasks(formData, "DELIVERED", "Produsele au fost marcate ca aduse.");
}

export async function markRestockUnavailableAction(
  _state: OperationActionState,
  formData: FormData,
): Promise<OperationActionState> {
  return markRestockTasks(
    formData,
    "UNAVAILABLE",
    "Produsele au fost mutate la indisponibile.",
  );
}

async function markRestockTasks(
  formData: FormData,
  status: "DELIVERED" | "UNAVAILABLE",
  successMessage: string,
): Promise<OperationActionState> {
  try {
    await requireOperationsWrite();
    const productId = readString(formData, "productId");
    const warehouseId = readString(formData, "warehouseId");

    if (!productId || !warehouseId) {
      throw new Error("Produs sau locație lipsă.");
    }

    const result = await prisma.restockTask.updateMany({
      where: {
        productId,
        warehouseId,
        status: "PENDING",
      },
      data: {
        status,
        resolvedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new Error("Nu mai există produse active pentru această poziție.");
    }

    revalidatePath("/");
    return { ok: true, message: successMessage };
  } catch (error) {
    return toActionError(error);
  }
}

async function requireOperationsWrite() {
  const appUser = await requireCurrentAppUser();

  if (!canWriteCatalog(appUser.role)) {
    throw new Error("Nu ai drepturi pentru modificarea stocului.");
  }
  return appUser;
}

/** Vânzările pot fi înregistrate și de ANGAJAT; restul operațiunilor nu. */
async function requireSalesWrite() {
  const appUser = await requireCurrentAppUser();

  if (!canCreateSales(appUser.role)) {
    throw new Error("Nu ai drepturi pentru înregistrarea vânzărilor.");
  }
  return appUser;
}

type StockDocumentKind = "RECEIPT" | "ADJUSTMENT" | "SALE" | "RETURN";
const RESTOCK_WAREHOUSE_NAME = "Pavilion 110A";

async function nextDocumentNumber(tx: TransactionClient, type: StockDocumentKind) {
  // Advisory lock per tip de document: două tranzacții simultane nu mai pot
  // lua același număr (unique [type, number] ar fi respins una din ele urât).
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stockdoc:${type}`}))`;

  const last = await tx.stockDocument.findFirst({
    where: { type },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  return (last?.number ?? 0) + 1;
}

async function updateWarehouseStock(
  tx: TransactionClient,
  input: {
    productId: string;
    warehouseId: string;
    quantity: number;
    kind: StockDocumentKind;
  },
) {
  const stock = await ensureWarehouseStockRow(tx, input.productId, input.warehouseId);
  // Validare timpurie cu mesaj prietenos (semn, stoc citit)…
  calculateNextQuantity(stock.quantity, input.kind, input.quantity);

  // …apoi update ATOMIC cu gardă finală: două vânzări simultane pe același
  // stoc nu mai pot trece amândouă — a doua vede rezultatul negativ și pică.
  const delta = input.kind === "SALE" ? -input.quantity : input.quantity;
  const rows = await tx.$queryRaw<{ quantity: number }[]>`
    UPDATE "WarehouseStock"
    SET quantity = quantity + ${delta}, "updatedAt" = now()
    WHERE id = ${stock.id}
    RETURNING quantity`;
  if ((rows[0]?.quantity ?? 0) < 0) {
    throw new Error("Stoc insuficient în locația selectată (modificat între timp).");
  }
}

async function ensureWarehouseStockRow(
  tx: TransactionClient,
  productId: string,
  warehouseId: string,
) {
  const existing = await tx.warehouseStock.findUnique({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  // Seed the FIRST per-warehouse row from the product's catalog stock so a
  // product imported with stock can be sold/moved. Once any warehouse row
  // exists, product.stock is already the sum of the rows, so a new row must
  // start at 0 — seeding it again would double the aggregate stock.
  const otherRows = await tx.warehouseStock.count({ where: { productId } });
  const product =
    otherRows === 0
      ? await tx.product.findUnique({
          where: { id: productId },
          select: { stock: true },
        })
      : null;

  return tx.warehouseStock.create({
    data: {
      productId,
      warehouseId,
      quantity: product?.stock ?? 0,
    },
  });
}

async function syncProductAggregateStock(tx: TransactionClient, productId: string) {
  const stocks = await tx.warehouseStock.findMany({
    where: { productId },
    select: { quantity: true },
  });
  const total = stocks.reduce((sum, stock) => sum + stock.quantity, 0);

  await tx.product.update({
    where: { id: productId },
    data: {
      stock: total,
      manuallyEdited: true,
    },
  });
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value : ""));
}

function readDate(formData: FormData, key: string) {
  const value = readString(formData, key);

  if (!value) {
    return new Date();
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Data documentului nu este validă.");
  }

  return parsed;
}

function toActionError(error: unknown): OperationActionState {
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }

  return initialError;
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
