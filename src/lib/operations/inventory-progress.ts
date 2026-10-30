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

/** Începutul implicit al numărătorii: acum 30 de zile (YYYY-MM-DD). */
export function defaultCountSince(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}
