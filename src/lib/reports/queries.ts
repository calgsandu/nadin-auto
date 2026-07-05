import { prisma } from "@/lib/prisma";
import { getExchangeRates } from "@/lib/currency/rates";

/**
 * Report aggregations (AS12 — extragerea datelor). Uses the DB view
 * `v_warehouse_stock` and the stored function `f_low_stock` (AS10) defined in
 * `scripts/sql/reports.sql`, plus Prisma aggregates for sales.
 */
export async function getReportsData() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [warehouseStock, lowStock, value, productAgg, salesAgg] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; total_quantity: number }[]>`
      SELECT id, name, total_quantity FROM v_warehouse_stock ORDER BY name`,
    // Sub pragul per produs (minStock, implicit 3) — înlocuiește f_low_stock(3).
    prisma.$queryRaw<{ id: string; description: string; stock: number | null; code: string | null; min_stock: number }[]>`
      SELECT id, description, stock, "externalCode" AS code,
             COALESCE("minStock", 3)::int AS min_stock
      FROM "Product"
      WHERE COALESCE(stock, 0) <= COALESCE("minStock", 3)
      ORDER BY COALESCE(stock, 0) ASC, description ASC
      LIMIT 200`,
    prisma.$queryRaw<{ value_eur: number; cost_lei: number; sale_lei: number }[]>`
      SELECT COALESCE(SUM(stock * "priceEuro"), 0)::float AS value_eur,
             COALESCE(SUM(stock * "costLei"), 0)::float AS cost_lei,
             COALESCE(SUM(stock * "salePriceLei"), 0)::float AS sale_lei
      FROM "Product"`,
    prisma.product.aggregate({ _count: true, _sum: { stock: true } }),
    // Sales store totalLei (legacy rows may only have totalEuro) — coalesce.
    prisma.$queryRaw<{ cnt: number; total_lei: number }[]>`
      SELECT COUNT(*)::int AS cnt,
             COALESCE(SUM(COALESCE("totalLei", "totalEuro")), 0)::float AS total_lei
      FROM "StockDocument"
      WHERE type = 'SALE' AND "documentDate" >= ${since}`,
  ]);

  const rates = await getExchangeRates();

  return {
    warehouseStock,
    lowStock,
    totalProducts: productAgg._count,
    totalStock: productAgg._sum.stock ?? 0,
    valueEur: value[0]?.value_eur ?? 0,
    costLei: value[0]?.cost_lei ?? 0,
    stockValueLei: value[0]?.sale_lei ?? 0,
    sales30Count: salesAgg[0]?.cnt ?? 0,
    sales30Lei: salesAgg[0]?.total_lei ?? 0,
    rates,
  };
}

export type ReportsData = Awaited<ReturnType<typeof getReportsData>>;
