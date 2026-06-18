"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { aggregateRestockRequests } from "@/lib/operations/restock";
import {
  ensureSupplierPartner,
  normalizeOptionalPartnerId,
} from "@/lib/operations/supplier-selection";

export type DocumentActionState = { ok: boolean; message: string };

const FALLBACK: DocumentActionState = { ok: false, message: "Operațiunea a eșuat." };

async function requireWrite() {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    throw new Error("Nu ai drepturi pentru această operațiune.");
  }
}

function fail(error: unknown): DocumentActionState {
  if (error instanceof Error) return { ok: false, message: error.message };
  return FALLBACK;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
    await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");

    await prisma.$transaction(async (tx) => {
      const doc = await tx.stockDocument.findUnique({ where: { id }, include: { lines: true } });
      if (!doc) throw new Error("Document inexistent.");

      for (const line of doc.lines) {
        const appliedEffect = doc.type === "SALE" ? -line.quantity : line.quantity;
        const stock = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: line.productId, warehouseId: doc.warehouseId } },
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

      await tx.restockTask.deleteMany({ where: { sourceDocumentId: id } });
      await tx.stockDocument.delete({ where: { id } });
    });

    revalidatePath("/");
    return { ok: true, message: "Document șters și stoc reversat." };
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
    await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");

    const productIds = formData.getAll("lineProductId").map((v) => String(v).trim());
    const quantities = formData.getAll("lineQuantity").map((v) => String(v));
    const prices = formData.getAll("linePrice").map((v) => String(v));

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
      if (!productId) throw new Error(`Produs lipsă pe poziția ${i + 1}.`);
      if (seenProducts.has(productId)) {
        throw new Error(`Produsul de pe poziția ${i + 1} este adăugat de mai multe ori.`);
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Cantitate invalidă pe poziția ${i + 1}.`);
      }
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        throw new Error(`Preț invalid pe poziția ${i + 1}.`);
      }
      seenProducts.add(productId);
      return { productId, quantity, price };
    });
    if (formLines.length === 0) throw new Error("Documentul trebuie să aibă cel puțin un produs.");

    await prisma.$transaction(async (tx) => {
      const doc = await tx.stockDocument.findUnique({
        where: { id },
        include: { lines: true, warehouse: { select: { name: true } } },
      });
      if (!doc) throw new Error("Document inexistent.");
      const isSale = doc.type === "SALE";
      const adjustmentSign =
        doc.type === "ADJUSTMENT" && doc.lines.some((line) => line.quantity < 0) ? -1 : 1;
      const newLines = formLines.map((line) => ({
        ...line,
        signedQuantity: doc.type === "ADJUSTMENT" ? line.quantity * adjustmentSign : line.quantity,
      }));

      // 1. Reverse old stock effect.
      const touched = new Set<string>();
      for (const line of doc.lines) {
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
            quantity: nl.signedQuantity,
            ...(isSale ? { unitPriceEuro: nl.price } : { unitCostLei: nl.price }),
          },
        });
        total += nl.quantity * (nl.price ?? 0);

        // 3. Apply new stock effect (seed row from product.stock if missing).
        let stock = await tx.warehouseStock.findUnique({
          where: { productId_warehouseId: { productId: nl.productId, warehouseId: doc.warehouseId } },
        });
        if (!stock) {
          const product = await tx.product.findUnique({ where: { id: nl.productId }, select: { stock: true } });
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

      if (isSale && doc.warehouse.name === "Pavilion 110A") {
        const existingRestockTasks = await tx.restockTask.count({
          where: { sourceDocumentId: id },
        });
        const removedPendingTasks = await tx.restockTask.deleteMany({
          where: { sourceDocumentId: id, status: "PENDING" },
        });

        if (existingRestockTasks === 0 || removedPendingTasks.count > 0) {
          await tx.restockTask.createMany({
            data: aggregateRestockRequests(newLines).map((line) => ({
              productId: line.productId,
              warehouseId: doc.warehouseId,
              sourceDocumentId: id,
              quantity: line.quantity,
              requestedAt: documentDate ?? doc.documentDate,
            })),
          });
        }
      }
    });

    revalidatePath("/");
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
    await requireWrite();
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

    await prisma.stockDocument.update({
      where: { id },
      data: { documentDate, notes, ...(partnerId !== undefined ? { partnerId } : {}) },
    });

    revalidatePath("/");
    return { ok: true, message: "Document actualizat." };
  } catch (error) {
    return fail(error);
  }
}
