import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 60;

export type PriceChangeRow = {
  id: string;
  createdAt: Date;
  productId: string;
  code: string | null;
  description: string;
  changedByName: string | null;
  costBefore: number | null;
  costAfter: number | null;
  saleBefore: number | null;
  saleAfter: number | null;
  euroBefore: number | null;
  euroAfter: number | null;
};

const toNumber = (value: { toString(): string } | null) =>
  value === null ? null : Number(value);

/** Ultimele modificări de preț, cel mai recent întâi. */
export async function getPriceHistoryData(params: { q?: string; page?: string } = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const term = params.q?.trim();
  const where = term
    ? {
        product: {
          OR: [
            { description: { contains: term, mode: "insensitive" as const } },
            { externalCode: { contains: term, mode: "insensitive" as const } },
          ],
        },
      }
    : {};

  const [total, changes] = await Promise.all([
    prisma.priceChange.count({ where }),
    prisma.priceChange.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        productId: true,
        changedByName: true,
        costLeiBefore: true,
        costLeiAfter: true,
        salePriceLeiBefore: true,
        salePriceLeiAfter: true,
        priceEuroBefore: true,
        priceEuroAfter: true,
        product: { select: { externalCode: true, description: true } },
      },
    }),
  ]);

  return {
    filters: { q: term ?? "" },
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
    changes: changes.map((change): PriceChangeRow => ({
      id: change.id,
      createdAt: change.createdAt,
      productId: change.productId,
      code: change.product.externalCode,
      description: change.product.description,
      changedByName: change.changedByName,
      costBefore: toNumber(change.costLeiBefore),
      costAfter: toNumber(change.costLeiAfter),
      saleBefore: toNumber(change.salePriceLeiBefore),
      saleAfter: toNumber(change.salePriceLeiAfter),
      euroBefore: toNumber(change.priceEuroBefore),
      euroAfter: toNumber(change.priceEuroAfter),
    })),
  };
}

export type PriceHistoryData = Awaited<ReturnType<typeof getPriceHistoryData>>;
