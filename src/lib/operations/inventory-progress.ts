import { prisma } from "@/lib/prisma";
import { inventoryWhere } from "@/lib/operations/inventory-filter";

/** Ultima numărătoare a unui produs într-un depozit: data (YYYY-MM-DD) și cât s-a găsit. */
export type CountedProduct = { date: string; counted: number };

/**
 * Produsele numărate, din snapshot-ul pe care inventarul îl scrie în istoric.
 * Documentul păstrează doar diferențele; snapshot-ul (`counts`) are tot ce s-a
 * numărat. Inventarele de dinainte de schimbare au în `counts` doar produsele
 * cu diferență — tot numărate, deci se socotesc la fel.
 */
export function countsFromAuditDetails(details: unknown): { productId: string; counted: number }[] {
  if (!details || typeof details !== "object") return [];
  const counts = (details as { counts?: unknown }).counts;
  if (!Array.isArray(counts)) return [];
  return counts.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { productId, counted } = entry as { productId?: unknown; counted?: unknown };
    return typeof productId === "string" && typeof counted === "number" ? [{ productId, counted }] : [];
  });
}

/**
 * Ce s-a numărat într-un depozit de la o dată încoace (inventarele șterse nu
 * contează). La același produs numărat de mai multe ori rămâne ultima dată.
 */
export async function getCountedProducts(warehouseId: string, since: string) {
  const documents = await prisma.stockDocument.findMany({
    where: inventoryWhere({ warehouseId, from: since }),
    select: { id: true, documentDate: true },
    orderBy: [{ documentDate: "asc" }, { number: "asc" }],
  });
  if (documents.length === 0) return {} as Record<string, CountedProduct>;

  const logs = await prisma.auditLog.findMany({
    where: {
      entity: "StockDocument",
      action: "CREATE",
      entityId: { in: documents.map((document) => document.id) },
    },
    select: { entityId: true, details: true },
  });
  const detailsByDocument = new Map(logs.map((log) => [log.entityId, log.details]));

  const counted: Record<string, CountedProduct> = {};
  for (const document of documents) {
    const date = document.documentDate.toISOString().slice(0, 10);
    for (const entry of countsFromAuditDetails(detailsByDocument.get(document.id))) {
      counted[entry.productId] = { date, counted: entry.counted };
    }
  }
  return counted;
}

/** O numărătoare trecută a unui produs: data, câte erau în sistem (dacă se știe) și câte s-au găsit. */
export type InventoryHistoryEntry = {
  date: string;
  number: number;
  before: number | null;
  counted: number | null;
  /** Diferența față de sistem; la inventarele vechi fără snapshot e singura informație. */
  difference: number | null;
};

/**
 * Rândul produsului dintr-un inventar: din snapshot (`counts`: era → numărat),
 * altfel din linia documentului (doar diferența). `null` = produsul nu era în inventar.
 */
export function historyEntryFor(
  productId: string,
  details: unknown,
  lineQuantity: number | null,
): Pick<InventoryHistoryEntry, "before" | "counted" | "difference"> | null {
  const counts =
    details && typeof details === "object" && Array.isArray((details as { counts?: unknown }).counts)
      ? ((details as { counts: unknown[] }).counts as { productId?: unknown; before?: unknown; counted?: unknown }[])
      : [];
  const entry = counts.find((item) => item && item.productId === productId);
  if (entry && typeof entry.counted === "number") {
    const before = typeof entry.before === "number" ? entry.before : null;
    return { before, counted: entry.counted, difference: before === null ? lineQuantity : entry.counted - before };
  }
  if (lineQuantity !== null) return { before: null, counted: null, difference: lineQuantity };
  return null;
}

/**
 * Ultimele numărători ale unor produse într-un depozit, cele mai noi întâi
 * (câte `limit` pe produs). Toate deodată: un inventar poate avea 100 de rânduri.
 */
export async function getInventoryHistory(productIds: string[], warehouseId: string, limit = 3) {
  const history: Record<string, InventoryHistoryEntry[]> = {};
  if (productIds.length === 0) return history;
  const documents = await prisma.stockDocument.findMany({
    where: inventoryWhere({ warehouseId }),
    select: {
      id: true,
      number: true,
      documentDate: true,
      lines: { where: { productId: { in: productIds } }, select: { productId: true, quantity: true } },
    },
    orderBy: [{ documentDate: "desc" }, { number: "desc" }],
    take: 200,
  });
  if (documents.length === 0) return history;

  const logs = await prisma.auditLog.findMany({
    where: {
      entity: "StockDocument",
      action: "CREATE",
      entityId: { in: documents.map((document) => document.id) },
    },
    select: { entityId: true, details: true },
  });
  const detailsByDocument = new Map(logs.map((log) => [log.entityId, log.details]));

  for (const productId of productIds) {
    const entries: InventoryHistoryEntry[] = [];
    for (const document of documents) {
      const line = document.lines.find((item) => item.productId === productId);
      const entry = historyEntryFor(productId, detailsByDocument.get(document.id), line?.quantity ?? null);
      if (!entry) continue;
      entries.push({ date: document.documentDate.toISOString().slice(0, 10), number: document.number, ...entry });
      if (entries.length >= limit) break;
    }
    if (entries.length > 0) history[productId] = entries;
  }
  return history;
}

/** Începutul implicit al numărătorii: acum 30 de zile (YYYY-MM-DD). */
export function defaultCountSince(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}
