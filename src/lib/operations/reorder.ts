import { prisma } from "@/lib/prisma";

/** Fereastra de vânzări din care propunem comanda. */
export const REORDER_DAYS = 60;
const DEFAULT_MIN_STOCK = 3;

/**
 * Lista „de comandat": piesele vândute în ultimele `REORDER_DAYS` zile care au
 * ajuns la pragul de stoc (sau la zero), grupate pe furnizorul ultimei recepții.
 * Cantitatea propusă = cât s-a vândut în fereastră: înlocuim ce a plecat.
 *
 * ponytail: retururile nu se scad din vândute; adaugă-le dacă ajung să conteze.
 */
export async function getReorderList(now = new Date()) {
  const since = new Date(now.getTime() - REORDER_DAYS * 24 * 60 * 60 * 1000);
  const sold = await prisma.stockDocumentLine.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, document: { type: "SALE", documentDate: { gte: since } } },
    _sum: { quantity: true },
  });
  const soldBy = new Map(sold.map((row) => [row.productId!, row._sum.quantity ?? 0]));
  if (soldBy.size === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: [...soldBy.keys()] } },
    select: {
      id: true,
      externalCode: true,
      description: true,
      stock: true,
      minStock: true,
      fitment: { include: { carModel: { include: { brand: true } } } },
    },
  });
  const low = products.filter((product) => (product.stock ?? 0) <= (product.minStock ?? DEFAULT_MIN_STOCK));
  if (low.length === 0) return [];

  // Ultima recepție cu furnizor, per piesă: de acolo am luat-o, de acolo o recomandăm.
  const receipts = await prisma.stockDocumentLine.findMany({
    where: { productId: { in: low.map((product) => product.id) }, document: { type: "RECEIPT", partnerId: { not: null } } },
    orderBy: { document: { documentDate: "desc" } },
    select: { productId: true, document: { select: { partner: { select: { id: true, name: true, phone: true } } } } },
  });
  const supplierBy = new Map<string, { id: string; name: string; phone: string | null }>();
  for (const line of receipts) {
    if (line.productId && line.document.partner && !supplierBy.has(line.productId)) {
      supplierBy.set(line.productId, line.document.partner);
    }
  }

  return groupBySupplier(
    low.map((product) => ({
      ...product,
      stock: product.stock ?? 0,
      sold: soldBy.get(product.id) ?? 0,
      supplier: supplierBy.get(product.id) ?? null,
    })),
  );
}

export type ReorderItem = {
  id: string;
  sold: number;
  stock: number;
  supplier: { id: string; name: string; phone: string | null } | null;
};

/** Furnizorii cu cele mai multe piese primii; piesele fără furnizor la coadă. */
export function groupBySupplier<T extends ReorderItem>(items: T[]) {
  const groups = new Map<string, { supplier: ReorderItem["supplier"]; items: T[] }>();
  for (const item of items) {
    const key = item.supplier?.id ?? "";
    const group = groups.get(key) ?? { supplier: item.supplier, items: [] as T[] };
    group.items.push(item);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => a.stock - b.stock || b.sold - a.sold);
  }
  return [...groups.values()].sort(
    (a, b) => Number(!a.supplier) - Number(!b.supplier) || b.items.length - a.items.length,
  );
}

export type ReorderGroup = Awaited<ReturnType<typeof getReorderList>>[number];
