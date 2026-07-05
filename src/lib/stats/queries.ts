import { prisma } from "@/lib/prisma";
import {
  aggregateSalesByPeriod,
  topSoldProducts,
  type StatsSale,
} from "@/lib/stats/aggregate";

/** Sales statistics: daily / weekly / monthly totals with cost and profit. */
export async function getStatsData() {
  const since = new Date();
  since.setMonth(since.getMonth() - 13);
  since.setHours(0, 0, 0, 0);

  const [sales, returns] = await Promise.all([
    prisma.stockDocument.findMany({
      where: { type: "SALE", documentDate: { gte: since } },
      select: {
        documentDate: true,
        lines: {
          select: {
            quantity: true,
            unitPriceEuro: true,
            productId: true,
            product: {
              select: { description: true, externalCode: true, costLei: true },
            },
          },
        },
      },
    }),
    prisma.stockDocument.aggregate({
      where: { type: "RETURN", documentDate: { gte: since } },
      _count: true,
      _sum: { totalLei: true },
    }),
  ]);

  const statsSales: StatsSale[] = sales.map((sale) => ({
    documentDate: sale.documentDate,
    lines: sale.lines.map((line) => ({
      quantity: line.quantity,
      unitPriceLei: Number(line.unitPriceEuro ?? 0),
      unitCostLei: Number(line.product.costLei ?? 0),
      productId: line.productId,
      productLabel: line.product.externalCode
        ? `${line.product.externalCode} · ${line.product.description}`
        : line.product.description,
    })),
  }));

  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sales30 = statsSales.filter((sale) => sale.documentDate >= last30);

  // KPI pe ultimele 30 de zile calendaristice (nu „zile cu vânzări").
  let revenue30 = 0;
  let profit30 = 0;
  let quantity30 = 0;
  for (const sale of sales30) {
    for (const line of sale.lines) {
      revenue30 += line.quantity * line.unitPriceLei;
      profit30 += line.quantity * (line.unitPriceLei - line.unitCostLei);
      quantity30 += line.quantity;
    }
  }

  return {
    daily: aggregateSalesByPeriod(statsSales, "day", 14),
    weekly: aggregateSalesByPeriod(statsSales, "week", 8),
    monthly: aggregateSalesByPeriod(statsSales, "month", 12),
    topProducts: topSoldProducts(sales30, 10),
    returnsCount: returns._count,
    returnsLei: Number(returns._sum.totalLei ?? 0),
    last30: {
      salesCount: sales30.length,
      quantity: quantity30,
      revenueLei: revenue30,
      profitLei: profit30,
      avgSaleLei: sales30.length > 0 ? revenue30 / sales30.length : 0,
    },
  };
}

export type StatsData = Awaited<ReturnType<typeof getStatsData>>;
