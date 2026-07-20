"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  documentSnapshot,
  logAudit,
  logAuditRequired,
} from "@/lib/audit";
import {
  aggregateRestockRequests,
  reconcileSaleRestockTasks,
} from "@/lib/operations/restock";
import {
  ensureSupplierPartner,
  normalizeOptionalPartnerId,
} from "@/lib/operations/supplier-selection";
import {
  assertCashRegisterDocumentType,
  cashRegisterLabel,
  parseOptionalCashRegistered,
} from "@/lib/operations/cash-register";
import {
  assertSalePaymentMethodDocumentType,
  parseOptionalSalePaymentMethod,
  salePaymentMethodLabel,
} from "@/lib/operations/sale-payment-method";

export type DocumentActionState = { ok: boolean; message: string };

const FALLBACK: DocumentActionState = { ok: false, message: "Operațiunea a eșuat." };

async function requireWrite() {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    throw new Error("Nu ai drepturi pentru această operațiune.");
  }
  return user;
}

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Recepție",
  SALE: "Vânzare",
  RETURN: "Retur",
  ADJUSTMENT: "Ajustare/Transfer",
};

function fail(error: unknown): DocumentActionState {
  if (error instanceof Error) return { ok: false, message: error.message };
  return FALLBACK;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateCashRegisteredAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");
    const cashRegistered = parseOptionalCashRegistered(
      readString(formData, "cashRegistered"),
    );
    let changed = false;

    await prisma.$transaction(async (tx) => {
      const doc = await tx.stockDocument.findUnique({
        where: { id },
        select: { id: true, type: true, number: true, cashRegistered: true },
      });
      if (!doc) throw new Error("Document inexistent.");
      assertCashRegisterDocumentType(doc.type);
      if (doc.cashRegistered === cashRegistered) return;

      await tx.stockDocument.update({
        where: { id },
        data: { cashRegistered },
      });
      await logAuditRequired(tx, user, {
        action: "UPDATE",
        entity: "StockDocument",
        entityId: id,
        summary: `Vânzare #${doc.number}: statut casă schimbat din „${cashRegisterLabel(doc.cashRegistered)}” în „${cashRegisterLabel(cashRegistered)}”`,
        details: {
          before: { cashRegistered: doc.cashRegistered },
          after: { cashRegistered },
        },
      });
      changed = true;
    });

    revalidatePath("/crm");
    return {
      ok: true,
      message: changed ? "Statutul de casă a fost actualizat." : "Statutul de casă este deja setat astfel.",
    };
  } catch (error) {
    return fail(error);
  }
}

export async function updateSalePaymentMethodAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");
    const paymentMethod = parseOptionalSalePaymentMethod(
      readString(formData, "paymentMethod"),
    );
    let changed = false;

    await prisma.$transaction(async (tx) => {
      const doc = await tx.stockDocument.findUnique({
        where: { id },
        select: { id: true, type: true, number: true, paymentMethod: true },
      });
      if (!doc) throw new Error("Document inexistent.");
      assertSalePaymentMethodDocumentType(doc.type);
      if (doc.paymentMethod === paymentMethod) return;

      await tx.stockDocument.update({
        where: { id },
        data: { paymentMethod },
      });
      await logAuditRequired(tx, user, {
        action: "UPDATE",
        entity: "StockDocument",
        entityId: id,
        summary: `Vânzare #${doc.number}: metoda de plată schimbată din „${salePaymentMethodLabel(doc.paymentMethod)}” în „${salePaymentMethodLabel(paymentMethod)}”`,
        details: {
          before: { paymentMethod: doc.paymentMethod },
          after: { paymentMethod },
        },
      });
      changed = true;
    });

    revalidatePath("/crm");
    return {
      ok: true,
      message: changed
        ? "Metoda de plată a fost actualizată."
        : "Metoda de plată este deja setată astfel.",
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Delete a stock document and reverse its stock effect:
 * RECEIPT/RETURN/ADJUSTMENT added `line.quantity` (signed), SALE subtracted it,
 * so we undo by subtracting the originally applied effect.
 */
export async function deleteDocumentAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");

    let message = "Document șters și stoc reversat.";
    await prisma.$transaction(async (tx) => {
      const include = {
        lines: { include: { product: { select: { description: true, externalCode: true } } } },
        warehouse: { select: { name: true } },
        partner: { select: { name: true } },
      } as const;
      const doc = await tx.stockDocument.findUnique({ where: { id }, include });
      if (!doc) throw new Error("Document inexistent.");

      // O vânzare cu retururi legate nu se poate șterge — s-ar dubla stocul
      // (returul a pus deja o parte din marfă înapoi).
      if (doc.type === "SALE") {
        const returnsCount = await tx.stockDocument.count({
          where: { type: "RETURN", sourceDocumentId: id },
        });
        if (returnsCount > 0) {
          throw new Error(
            `Vânzarea are ${returnsCount} retur(uri) legate. Șterge întâi retururile.`,
          );
        }
      }

      // Un transfer are două jumătăți (ieșire + intrare) — se șterg împreună,
      // altfel stocul rămâne dezechilibrat.
      const docsToDelete = doc.transferGroupId
        ? await tx.stockDocument.findMany({
            where: { transferGroupId: doc.transferGroupId },
            include,
          })
        : [doc];

      for (const target of docsToDelete) {
        await logAuditRequired(tx, user, {
          action: "DELETE",
          entity: "StockDocument",
          entityId: target.id,
          summary: `${TYPE_LABEL[target.type] ?? target.type} #${target.number} ștearsă (${target.lines.length} produse) — stoc reversat`,
          details: { deleted: documentSnapshot(target) },
        });

        for (const line of target.lines) {
          // Liniile externe nu au atins stocul — nu e nimic de reversat.
          if (!line.productId) continue;
          const appliedEffect = target.type === "SALE" ? -line.quantity : line.quantity;
          const stock = await tx.warehouseStock.findUnique({
            where: { productId_warehouseId: { productId: line.productId, warehouseId: target.warehouseId } },
          });
          if (stock) {
            await tx.warehouseStock.update({
              where: { id: stock.id },
              data: { quantity: stock.quantity - appliedEffect },
            });
          }
          const stocks = await tx.warehouseStock.findMany({
            where: { productId: line.productId },
            select: { quantity: true },
          });
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: stocks.reduce((sum, s) => sum + s.quantity, 0) },
          });
        }

        await tx.restockTask.deleteMany({ where: { sourceDocumentId: target.id } });
        await tx.stockDocument.delete({ where: { id: target.id } });
      }

      // Retur șters = recalculează exact ce a rămas de adus pentru vânzare.
      if (doc.type === "RETURN" && doc.sourceDocumentId) {
        await reconcileSaleRestockTasks(tx, doc.sourceDocumentId);
      }

      if (docsToDelete.length > 1) {
        message = "Transfer șters (ambele jumătăți) și stoc reversat.";
      }
    });

    revalidatePath("/crm");
    return { ok: true, message };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Edit a document's lines (quantity + unit price) and header, reconciling stock.
 * Strategy: reverse the old lines' stock effect, replace the lines, re-apply.
 * Product per line stays fixed (productId is carried in a hidden field).
 */
export async function updateDocumentLinesAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");

    const productIds = formData.getAll("lineProductId").map((v) => String(v).trim());
    const quantities = formData.getAll("lineQuantity").map((v) => String(v));
    const prices = formData.getAll("linePrice").map((v) => String(v));
    const externalNames = formData.getAll("lineExternalName").map((v) => String(v).trim());
    const externalCodes = formData.getAll("lineExternalCode").map((v) => String(v).trim());
    const externalSupplierIds = formData.getAll("lineExternalSupplierId").map((v) => String(v).trim());
    const externalCosts = formData.getAll("lineExternalCostLei").map((v) => String(v));

    const dateRaw = readString(formData, "documentDate");
    const notes = readString(formData, "notes") || null;
    const partnerName = readString(formData, "partnerName");
    const selectedPartnerId = normalizeOptionalPartnerId(readString(formData, "partnerId"));
    const documentDate = dateRaw ? new Date(`${dateRaw}T12:00:00`) : undefined;
    if (documentDate && Number.isNaN(documentDate.getTime())) {
      throw new Error("Data documentului nu este validă.");
    }

    const seenProducts = new Set<string>();
    const formLines = productIds.map((productId, i) => {
      const quantity = Number(quantities[i]);
      const raw = (prices[i] ?? "").trim().replace(",", ".");
      const price = raw ? Number(raw) : null;
      const externalName = externalNames[i] ?? "";
      const rawCost = (externalCosts[i] ?? "").trim().replace(",", ".");
      const externalCost = rawCost ? Number(rawCost) : null;
      if (!productId && !externalName) throw new Error(`Produs lipsă pe poziția ${i + 1}.`);
      if (productId && seenProducts.has(productId)) {
        throw new Error(`Produsul de pe poziția ${i + 1} este adăugat de mai multe ori.`);
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Cantitate invalidă pe poziția ${i + 1}.`);
      }
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        throw new Error(`Preț invalid pe poziția ${i + 1}.`);
      }
      if (externalCost !== null && (!Number.isFinite(externalCost) || externalCost < 0)) {
        throw new Error(`Cost invalid pe poziția ${i + 1}.`);
      }
      if (productId) seenProducts.add(productId);
      return {
        productId: productId || null,
        externalName: productId ? null : externalName || null,
        externalCode: productId ? null : externalCodes[i] || null,
        externalSupplierId: productId ? null : externalSupplierIds[i] || null,
        externalCost: productId ? null : externalCost,
        quantity,
        price,
      };
    });
    if (formLines.length === 0) throw new Error("Documentul trebuie să aibă cel puțin un produs.");

    await prisma.$transaction(async (tx) => {
      const doc = await tx.stockDocument.findUnique({
        where: { id },
        include: {
          lines: { include: { product: { select: { description: true, externalCode: true } } } },
          warehouse: { select: { name: true } },
          partner: { select: { name: true } },
        },
      });
      if (!doc) throw new Error("Document inexistent.");

      // Jumătățile de transfer nu se editează pe linii — ar desincroniza
      // cealaltă jumătate. Se șterge transferul și se creează din nou.
      if (doc.transferGroupId) {
        throw new Error(
          "Transferurile nu se pot edita pe produse. Șterge transferul (se șterg ambele jumătăți) și creează-l din nou.",
        );
      }

      const beforeSnapshot = documentSnapshot(doc);
      const isSale = doc.type === "SALE";
      const returnPriceByProduct = new Map<string, number | null>();

      if (doc.type === "RETURN") {
        if (!doc.sourceDocumentId) {
          throw new Error(
            "Returul nu mai are legătura cu vânzarea sursă și nu poate fi editat.",
          );
        }
        const lockedSale = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "StockDocument"
          WHERE id = ${doc.sourceDocumentId} AND type = 'SALE'
          FOR UPDATE`;
        if (lockedSale.length === 0) {
          throw new Error("Vânzarea sursă a returului nu mai există.");
        }
        const sourceSale = await tx.stockDocument.findUnique({
          where: { id: doc.sourceDocumentId },
          include: { lines: true },
        });
        if (!sourceSale || sourceSale.type !== "SALE") {
          throw new Error("Vânzarea sursă a returului nu mai există.");
        }
        if (sourceSale.warehouseId !== doc.warehouseId) {
          throw new Error("Returul și vânzarea sursă au locații diferite.");
        }
        if (documentDate && documentDate < sourceSale.documentDate) {
          throw new Error(
            "Data returului nu poate fi înaintea datei vânzării.",
          );
        }

        const otherReturnLines = await tx.stockDocumentLine.findMany({
          where: {
            document: {
              type: "RETURN",
              sourceDocumentId: doc.sourceDocumentId,
              NOT: { id },
            },
          },
          select: { productId: true, quantity: true },
        });
        const returnedElsewhere = new Map<string, number>();
        for (const line of otherReturnLines) {
          if (!line.productId) continue;
          returnedElsewhere.set(
            line.productId,
            (returnedElsewhere.get(line.productId) ?? 0) + line.quantity,
          );
        }
        const soldByProduct = new Map(
          sourceSale.lines.map((line) => [line.productId, line]),
        );
        for (const line of formLines) {
          const sold = line.productId ? soldByProduct.get(line.productId) : null;
          if (!sold || !line.productId) {
            throw new Error(
              "Un produs din retur nu face parte din vânzarea sursă.",
            );
          }
          const available =
            sold.quantity - (returnedElsewhere.get(line.productId) ?? 0);
          if (line.quantity > available) {
            throw new Error(
              `Cantitatea returnată depășește ce a rămas de returnat (${Math.max(available, 0)} din ${sold.quantity} vândute).`,
            );
          }
          returnPriceByProduct.set(
            line.productId,
            sold.unitPriceEuro == null ? null : Number(sold.unitPriceEuro),
          );
        }
      }

      // O vânzare nu poate scădea sub cantitățile deja returnate.
      if (isSale) {
        const returnLines = await tx.stockDocumentLine.findMany({
          where: { document: { type: "RETURN", sourceDocumentId: id } },
          select: { productId: true, quantity: true },
        });
        const returnedByProduct = new Map<string, number>();
        for (const line of returnLines) {
          if (!line.productId) continue;
          returnedByProduct.set(
            line.productId,
            (returnedByProduct.get(line.productId) ?? 0) + line.quantity,
          );
        }
        for (const [productId, returned] of returnedByProduct) {
          const newQuantity = formLines.find((l) => l.productId === productId)?.quantity ?? 0;
          if (newQuantity < returned) {
            throw new Error(
              `Un produs are deja ${returned} bucăți returnate — cantitatea vândută nu poate scădea sub atât. Șterge întâi returul.`,
            );
          }
        }
      }

      // Sales AND returns carry the per-line price in unitPriceEuro (lei).
      const priceField = isSale || doc.type === "RETURN" ? "unitPriceEuro" : "unitCostLei";
      // Ajustările (ex. inventar) pot avea semne mixte pe linii — păstrează
      // semnul original per produs; produsele nou-adăugate intră cu plus.
      const signByProduct = new Map(
        doc.lines.map((line) => [line.productId, line.quantity < 0 ? -1 : 1]),
      );
      const newLines = formLines.map((line) => ({
        ...line,
        price:
          doc.type === "RETURN"
            ? (line.productId ? (returnPriceByProduct.get(line.productId) ?? null) : null)
            : line.price,
        signedQuantity:
          doc.type === "ADJUSTMENT"
            ? line.quantity * ((line.productId ? signByProduct.get(line.productId) : null) ?? 1)
            : line.quantity,
      }));

      // 1. Reverse old stock effect (liniile externe n-au atins stocul).
      const touched = new Set<string>();
      for (const line of doc.lines) {
        if (!line.productId) continue;
        const appliedEffect = isSale ? -line.quantity : line.quantity;
        const stock = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: line.productId, warehouseId: doc.warehouseId } },
        });
        if (stock) {
          await tx.warehouseStock.update({ where: { id: stock.id }, data: { quantity: stock.quantity - appliedEffect } });
        }
        touched.add(line.productId);
      }

      // 2. Replace lines.
      await tx.stockDocumentLine.deleteMany({ where: { documentId: id } });
      let total = 0;
      for (const nl of newLines) {
        await tx.stockDocumentLine.create({
          data: {
            documentId: id,
            productId: nl.productId,
            externalName: nl.externalName,
            externalCode: nl.externalCode,
            externalSupplierId: nl.externalSupplierId,
            quantity: nl.signedQuantity,
            [priceField]: nl.price,
            ...(nl.productId ? {} : { unitCostLei: nl.externalCost }),
          },
        });
        total += nl.quantity * (nl.price ?? 0);

        // Liniile externe nu ating stocul.
        if (!nl.productId) continue;

        // 3. Apply new stock effect (seed row from product.stock if missing).
        let stock = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: nl.productId, warehouseId: doc.warehouseId } },
        });
        if (!stock) {
          // First-ever row seeds from product.stock; later rows start at 0
          // (product.stock is already the sum of existing rows — see actions.ts).
          const otherRows = await tx.warehouseStock.count({ where: { productId: nl.productId } });
          const product =
            otherRows === 0
              ? await tx.product.findUnique({ where: { id: nl.productId }, select: { stock: true } })
              : null;
          stock = await tx.warehouseStock.create({
            data: { productId: nl.productId, warehouseId: doc.warehouseId, quantity: product?.stock ?? 0 },
          });
        }
        const next = isSale ? stock.quantity - nl.quantity : stock.quantity + nl.signedQuantity;
        if (next < 0) throw new Error(`Stoc insuficient pentru un produs din document.`);
        await tx.warehouseStock.update({ where: { id: stock.id }, data: { quantity: next } });
        touched.add(nl.productId);
      }

      // 4. Resync product aggregate stock for every touched product.
      for (const productId of touched) {
        const stocks = await tx.warehouseStock.findMany({ where: { productId }, select: { quantity: true } });
        await tx.product.update({ where: { id: productId }, data: { stock: stocks.reduce((s, x) => s + x.quantity, 0) } });
      }

      // 5. Header + total (lei).
      let partnerId: string | null | undefined = undefined;
      if (doc.type === "RECEIPT") {
        const partner = selectedPartnerId
          ? await tx.partner.findUnique({
              where: { id: selectedPartnerId },
              select: { id: true, kind: true },
            })
          : null;
        partnerId = ensureSupplierPartner(partner, selectedPartnerId);
      } else if (partnerName) {
        const partner = await tx.partner.upsert({ where: { name: partnerName }, create: { name: partnerName }, update: {} });
        partnerId = partner.id;
      }
      await tx.stockDocument.update({
        where: { id },
        data: { documentDate, notes, totalLei: total, totalEuro: null, ...(partnerId !== undefined ? { partnerId } : {}) },
      });

      if (doc.type === "RETURN" && doc.sourceDocumentId) {
        await reconcileSaleRestockTasks(tx, doc.sourceDocumentId);
      }

      if (isSale && doc.warehouse.name === "Pavilion 110A") {
        const existingRestockTasks = await tx.restockTask.count({
          where: { sourceDocumentId: id },
        });
        const removedPendingTasks = await tx.restockTask.deleteMany({
          where: { sourceDocumentId: id, status: "PENDING" },
        });

        if (existingRestockTasks === 0 || removedPendingTasks.count > 0) {
          const catalogLines = newLines.filter(
            (line): line is typeof line & { productId: string } => line.productId != null,
          );
          await tx.restockTask.createMany({
            data: aggregateRestockRequests(catalogLines).map((line) => ({
              productId: line.productId,
              warehouseId: doc.warehouseId,
              sourceDocumentId: id,
              quantity: line.quantity,
              requestedAt: documentDate ?? doc.documentDate,
            })),
          });
        }
      }

      const updated = await tx.stockDocument.findUnique({
        where: { id },
        include: {
          lines: { include: { product: { select: { description: true, externalCode: true } } } },
          warehouse: { select: { name: true } },
          partner: { select: { name: true } },
        },
      });
      if (updated) {
        await logAuditRequired(tx, user, {
          action: "UPDATE",
          entity: "StockDocument",
          entityId: id,
          summary: `${TYPE_LABEL[doc.type] ?? doc.type} #${doc.number} editată (linii + antet)`,
          details: { before: beforeSnapshot, after: documentSnapshot(updated) },
        });
      }
    });

    revalidatePath("/crm");
    return { ok: true, message: "Document actualizat (linii + stoc)." };
  } catch (error) {
    return fail(error);
  }
}

/** Edit document header fields (date, notes, partner). Does not touch stock/lines. */
export async function updateDocumentHeaderAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");

    const dateRaw = readString(formData, "documentDate");
    const notes = readString(formData, "notes") || null;
    const partnerName = readString(formData, "partnerName");

    const documentDate = dateRaw ? new Date(`${dateRaw}T12:00:00`) : undefined;
    if (documentDate && Number.isNaN(documentDate.getTime())) {
      throw new Error("Data documentului nu este validă.");
    }

    let partnerId: string | null | undefined = undefined;
    if (partnerName) {
      const partner = await prisma.partner.upsert({
        where: { name: partnerName },
        create: { name: partnerName },
        update: {},
      });
      partnerId = partner.id;
    }

    const before = await prisma.stockDocument.findUnique({
      where: { id },
      select: { type: true, number: true, documentDate: true, notes: true, partner: { select: { name: true } } },
    });
    if (!before) throw new Error("Document inexistent.");

    await prisma.stockDocument.update({
      where: { id },
      data: { documentDate, notes, ...(partnerId !== undefined ? { partnerId } : {}) },
    });

    await logAudit(prisma, user, {
      action: "UPDATE",
      entity: "StockDocument",
      entityId: id,
      summary: `${TYPE_LABEL[before.type] ?? before.type} #${before.number} — antet editat`,
      details: {
        before: {
          documentDate: before.documentDate.toISOString().slice(0, 10),
          notes: before.notes,
          partner: before.partner?.name ?? null,
        },
        after: {
          documentDate: (documentDate ?? before.documentDate).toISOString().slice(0, 10),
          notes,
          partner: partnerName || (before.partner?.name ?? null),
        },
      },
    });

    revalidatePath("/crm");
    return { ok: true, message: "Document actualizat." };
  } catch (error) {
    return fail(error);
  }
}
