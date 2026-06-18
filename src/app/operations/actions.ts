"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
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
    await requireOperationsWrite();
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
    await requireOperationsWrite();
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

      await tx.stockDocument.create({
        data: {
          type: "ADJUSTMENT",
          number: firstNumber,
          documentDate,
          warehouseId: sourceWarehouseId,
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
    await requireOperationsWrite();
    const warehouseId = readString(formData, "warehouseId");
    const documentDate = readDate(formData, "documentDate");
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
}

type StockDocumentKind = "RECEIPT" | "ADJUSTMENT" | "SALE";
const RESTOCK_WAREHOUSE_NAME = "Pavilion 110A";

async function nextDocumentNumber(tx: TransactionClient, type: StockDocumentKind) {
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
  const nextQuantity = calculateNextQuantity(stock.quantity, input.kind, input.quantity);

  await tx.warehouseStock.update({
    where: { id: stock.id },
    data: { quantity: nextQuantity },
  });
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

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stock: true },
  });

  // Seed a new per-warehouse row from the product's catalog stock so that a
  // product that shows stock can actually be sold/moved (previously only the
  // default warehouse inherited it, causing "stoc insuficient" elsewhere).
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
