import type { Prisma } from "@/generated/prisma/client";
import { logAuditRequired, type AuditActor } from "@/lib/audit";
import { formatDateInputValue } from "@/lib/operations/date-input";
import { inventoryDocumentWhere } from "@/lib/operations/inventory-filter";
import { calculateReceiptTotalLei } from "@/lib/operations/receipt-lines";
import { nextStockDocumentNumber } from "@/lib/operations/stock-mutations";
import { ensureSupplierPartner } from "@/lib/operations/supplier-selection";

/**
 * Stocul schimbat din fișa produsului nu mai e „de capul lui": intră într-un
 * document — inventar (s-a numărat altfel) sau recepție (a venit marfă).
 *
 * Documentul e fie unul ales (un inventar sau o recepție deja existente), fie
 * cel „de azi" din fișe: toate schimbările dintr-o zi, pe un depozit (și, la
 * recepție, de la același furnizor) merg în ACELAȘI document — un inventar
 * inițial făcut din fișe e un singur document, nu o mie.
 */
export type StockReason = "inventory" | "receipt";

export const PRODUCT_FORM_INVENTORY_NOTE = "Inventar: din fișa produsului";
export const PRODUCT_FORM_RECEIPT_NOTE = "Recepție din fișa produsului";

export type WarehouseStockChange = { warehouseId: string; before: number; after: number };

export function readStockReason(value: FormDataEntryValue | null): StockReason | null {
  return value === "inventory" || value === "receipt" ? value : null;
}

/** Depozitele unde cantitatea chiar s-a schimbat, plus verificarea motivului. */
export function stockChanges(
  before: Map<string, number>,
  after: { warehouseId: string; quantity: number }[],
  reason: StockReason | null,
): WarehouseStockChange[] {
  const changes = after
    .map((row) => ({ warehouseId: row.warehouseId, before: before.get(row.warehouseId) ?? 0, after: row.quantity }))
    .filter((row) => row.after !== row.before);
  if (changes.length === 0) return changes;
  if (!reason) {
    throw new Error("Stocul s-a schimbat: alege dacă e inventar sau marfă adusă.");
  }
  if (reason === "receipt" && changes.some((row) => row.after < row.before)) {
    throw new Error("La marfă adusă stocul doar crește. Pentru scădere alege Inventar.");
  }
  return changes;
}

/** Ziua documentului, în aceeași formă ca data aleasă în formularele de operațiuni. */
function today() {
  return new Date(`${formatDateInputValue(new Date())}T12:00:00`);
}

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

type TargetDocument = { id: string; number: number; warehouseId: string; partnerId: string | null };

export async function recordProductStockChanges(
  tx: Prisma.TransactionClient,
  user: AuditActor,
  input: {
    productId: string;
    reason: StockReason | null;
    changes: WarehouseStockChange[];
    /** Costul din fișă: prețul de intrare pe linia de recepție. */
    costLei: number | null;
    /** Un document existent ales în fișă; gol = documentul de azi din fișe. */
    documentId?: string | null;
    /** Furnizorul recepției noi (la una existentă rămâne al ei). */
    partnerId?: string | null;
  },
) {
  const { reason, changes } = input;
  if (!reason || changes.length === 0) return;

  const chosen = input.documentId ? await loadChosenDocument(tx, input.documentId, reason, changes) : null;
  const partnerId = reason === "receipt" && !chosen ? await supplierId(tx, input.partnerId ?? null) : null;

  for (const change of changes) {
    const diff = change.after - change.before;
    const { document, created } = chosen
      ? { document: chosen, created: false }
      : await todaysDocument(tx, reason, change.warehouseId, partnerId);

    if (reason === "inventory") {
      await appendLine(tx, document.id, input.productId, diff, undefined);
      await logAuditRequired(tx, user, {
        action: created ? "CREATE" : "UPDATE",
        entity: "StockDocument",
        entityId: document.id,
        summary: `Inventar #${document.number} din fișa produsului: ${diff > 0 ? "+" : ""}${diff} buc.`,
        // Același format ca inventarul obișnuit: progresul și istoricul numărătorii îl citesc.
        details: {
          warehouseId: change.warehouseId,
          diffs: [{ productId: input.productId, quantity: diff }],
          counts: [{ productId: input.productId, before: change.before, counted: change.after }],
        },
      });
    } else {
      await appendLine(tx, document.id, input.productId, diff, input.costLei);
      await refreshReceiptTotal(tx, document.id);
      await logAuditRequired(tx, user, {
        action: created ? "CREATE" : "UPDATE",
        entity: "StockDocument",
        entityId: document.id,
        summary: `Recepție #${document.number} din fișa produsului: +${diff} buc.`,
        details: {
          warehouseId: change.warehouseId,
          lines: [{ productId: input.productId, quantity: diff, unitCostLei: input.costLei }],
        },
      });
    }
  }
}

/** Documentul ales trebuie să fie de tipul potrivit și pe depozitul schimbat. */
async function loadChosenDocument(
  tx: Prisma.TransactionClient,
  documentId: string,
  reason: StockReason,
  changes: WarehouseStockChange[],
): Promise<TargetDocument> {
  const document = await tx.stockDocument.findFirst({
    where: reason === "inventory" ? { id: documentId, ...inventoryDocumentWhere() } : { id: documentId, type: "RECEIPT" },
    select: { id: true, number: true, warehouseId: true, partnerId: true, warehouse: { select: { name: true } } },
  });
  if (!document) {
    throw new Error(reason === "inventory" ? "Inventarul ales nu mai există." : "Recepția aleasă nu mai există.");
  }
  if (changes.some((change) => change.warehouseId !== document.warehouseId)) {
    throw new Error(
      `Documentul ales e pe ${document.warehouse.name}: schimbă stocul doar acolo sau alege „document nou".`,
    );
  }
  return document;
}

async function supplierId(tx: Prisma.TransactionClient, partnerId: string | null) {
  if (!partnerId) return null;
  const partner = await tx.partner.findUnique({ where: { id: partnerId }, select: { id: true, kind: true } });
  return ensureSupplierPartner(partner, partnerId);
}

/** Documentul de azi din fișe pentru depozit (și furnizor); îl creează la prima schimbare. */
async function todaysDocument(
  tx: Prisma.TransactionClient,
  reason: StockReason,
  warehouseId: string,
  partnerId: string | null,
): Promise<{ document: TargetDocument; created: boolean }> {
  const documentDate = today();
  const type = reason === "inventory" ? "ADJUSTMENT" : "RECEIPT";
  const notes = reason === "inventory" ? PRODUCT_FORM_INVENTORY_NOTE : PRODUCT_FORM_RECEIPT_NOTE;
  const select = { id: true, number: true, warehouseId: true, partnerId: true } as const;

  const existing = await tx.stockDocument.findFirst({
    where: { type, warehouseId, partnerId, notes, documentDate: dayRange(documentDate) },
    select,
  });
  if (existing) return { document: existing, created: false };

  const document = await tx.stockDocument.create({
    data: { type, number: await nextStockDocumentNumber(tx, type), documentDate, warehouseId, partnerId, notes },
    select,
  });
  return { document, created: true };
}

/**
 * Pune piesa în document: dacă e deja acolo, cantitatea se adună. La inventar
 * o linie ajunsă la zero dispare (diferența s-a anulat); `unitCostLei`
 * nedefinit = linia nu are cost (inventar).
 */
async function appendLine(
  tx: Prisma.TransactionClient,
  documentId: string,
  productId: string,
  quantity: number,
  unitCostLei: number | null | undefined,
) {
  const line = await tx.stockDocumentLine.findFirst({
    where: { documentId, productId },
    select: { id: true, quantity: true },
  });
  const cost = unitCostLei === undefined ? {} : { unitCostLei };
  if (!line) {
    await tx.stockDocumentLine.create({ data: { documentId, productId, quantity, ...cost } });
    return;
  }
  const next = line.quantity + quantity;
  if (next === 0) {
    await tx.stockDocumentLine.delete({ where: { id: line.id } });
  } else {
    await tx.stockDocumentLine.update({ where: { id: line.id }, data: { quantity: next, ...cost } });
  }
}

/** Totalul recepției, recalculat din linii după fiecare adăugare. */
async function refreshReceiptTotal(tx: Prisma.TransactionClient, documentId: string) {
  const lines = await tx.stockDocumentLine.findMany({
    where: { documentId },
    select: { quantity: true, unitCostLei: true },
  });
  // Aceeași regulă ca la recepția obișnuită (fără niciun cost = total necunoscut).
  const totalLei = calculateReceiptTotalLei(
    lines.map((line) => ({
      productId: "",
      quantity: line.quantity,
      unitCostLei: line.unitCostLei == null ? null : Number(line.unitCostLei),
    })),
  );
  await tx.stockDocument.update({ where: { id: documentId }, data: { totalLei } });
}
