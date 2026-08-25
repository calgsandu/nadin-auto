import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  periodLabelFromKey,
  type PeriodTotals,
  type StatsPeriod,
  type TopProduct,
} from "@/lib/stats/aggregate";

type PeriodRow = {
  period: StatsPeriod;
  key: string;
  sales_count: number;
  quantity: number;
  revenue_lei: number;
  cost_lei: number;
};

type TopProductRow = {
  product_id: string;
  label: string;
  quantity: number;
  revenue_lei: number;
};

type Kpi30Row = {
  sales_count: number;
  quantity: number;
  revenue_lei: number;
  profit_lei: number;
};

/**
 * Costul unei linii: produsele de catalog îl iau din fișa produsului, liniile
 * externe și-l poartă pe linie. Aceeași regulă ca la vânzare.
 */
const LINE_COST = Prisma.sql`
  CASE
    WHEN l."productId" IS NOT NULL THEN COALESCE(p."costLei", 0)
    ELSE COALESCE(l."unitCostLei", 0)
  END`;

/**
 * Eticheta din „Top produse": codul extern + denumirea pentru produsele proprii,
 * denumirea liberă marcată „(extern)" pentru piesele aduse de la furnizor.
 */
const PRODUCT_LABEL = Prisma.sql`
  CASE
    WHEN l."productId" IS NOT NULL THEN
      CASE
        WHEN p."externalCode" IS NOT NULL THEN p."externalCode" || ' · ' || p.description
        ELSE p.description
      END
    ELSE
      COALESCE(l."externalCode" || ' · ', '')
        || COALESCE(l."externalName", 'Piesă externă') || ' (extern)'
  END`;

/**
 * Statistici de vânzări: totaluri zilnice / săptămânale / lunare cu cost și profit.
 *
 * Agregarea se face în Postgres. Înainte se aduceau în memorie toate vânzările
 * din 13 luni împreună cu fiecare linie și produsul ei, apoi se însumau în JS —
 * costul creștea liniar cu vechimea magazinului, deși rezultatul are câteva
 * zeci de rânduri. `LEFT JOIN` pe linii păstrează în numărătoare și vânzările
 * fără linii, exact ca varianta din JS.
 */
export async function getStatsData() {
  const since = new Date();
  since.setMonth(since.getMonth() - 13);
  since.setHours(0, 0, 0, 0);
  const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const saleLines = (from: Date) => Prisma.sql`
    SELECT d.id,
           d."documentDate" AS doc_date,
           COALESCE(l.quantity, 0)::int AS qty,
           COALESCE(l.quantity, 0) * COALESCE(l."unitPriceEuro", 0) AS revenue,
           COALESCE(l.quantity, 0) * ${LINE_COST} AS cost
    FROM "StockDocument" d
    LEFT JOIN "StockDocumentLine" l ON l."documentId" = d.id
    LEFT JOIN "Product" p ON p.id = l."productId"
    WHERE d.type = 'SALE' AND d."documentDate" >= ${from}`;

  const [periods, topProductRows, kpiRows, returns] = await Promise.all([
    prisma.$queryRaw<PeriodRow[]>`
      WITH sale_lines AS (${saleLines(since)}),
      buckets AS (
        SELECT 'day' AS period, to_char(doc_date, 'YYYY-MM-DD') AS key, id, qty, revenue, cost
        FROM sale_lines
        UNION ALL
        SELECT 'week', to_char(doc_date, 'IYYY-"W"IW'), id, qty, revenue, cost FROM sale_lines
        UNION ALL
        SELECT 'month', to_char(doc_date, 'YYYY-MM'), id, qty, revenue, cost FROM sale_lines
      )
      SELECT period,
             key,
             COUNT(DISTINCT id)::int AS sales_count,
             COALESCE(SUM(qty), 0)::int AS quantity,
             COALESCE(SUM(revenue), 0)::float8 AS revenue_lei,
             COALESCE(SUM(cost), 0)::float8 AS cost_lei
      FROM buckets
      GROUP BY period, key
      ORDER BY key DESC`,

    prisma.$queryRaw<TopProductRow[]>`
      SELECT COALESCE(l."productId", 'extern:' || COALESCE(l."externalName", '?')) AS product_id,
             ${PRODUCT_LABEL} AS label,
             SUM(l.quantity)::int AS quantity,
             SUM(l.quantity * COALESCE(l."unitPriceEuro", 0))::float8 AS revenue_lei
      FROM "StockDocument" d
      JOIN "StockDocumentLine" l ON l."documentId" = d.id
      LEFT JOIN "Product" p ON p.id = l."productId"
      WHERE d.type = 'SALE' AND d."documentDate" >= ${last30}
      GROUP BY product_id, label
      ORDER BY quantity DESC, revenue_lei DESC, product_id
      LIMIT 10`,

    prisma.$queryRaw<Kpi30Row[]>`
      WITH sale_lines AS (${saleLines(last30)})
      SELECT COUNT(DISTINCT id)::int AS sales_count,
             COALESCE(SUM(qty), 0)::int AS quantity,
             COALESCE(SUM(revenue), 0)::float8 AS revenue_lei,
             COALESCE(SUM(revenue - cost), 0)::float8 AS profit_lei
      FROM sale_lines`,

    prisma.stockDocument.aggregate({
      where: { type: "RETURN", documentDate: { gte: since } },
      _count: true,
      _sum: { totalLei: true },
    }),
  ]);

  const kpi = kpiRows[0] ?? {
    sales_count: 0,
    quantity: 0,
    revenue_lei: 0,
    profit_lei: 0,
  };

  const topProducts: TopProduct[] = topProductRows.map((row) => ({
    productId: row.product_id,
    label: row.label,
    quantity: row.quantity,
    revenueLei: row.revenue_lei,
  }));

  return {
    daily: bucketsFor(periods, "day", 14),
    weekly: bucketsFor(periods, "week", 8),
    monthly: bucketsFor(periods, "month", 12),
    topProducts,
    returnsCount: returns._count,
    returnsLei: Number(returns._sum.totalLei ?? 0),
    last30: {
      salesCount: kpi.sales_count,
      quantity: kpi.quantity,
      revenueLei: kpi.revenue_lei,
      profitLei: kpi.profit_lei,
      avgSaleLei: kpi.sales_count > 0 ? kpi.revenue_lei / kpi.sales_count : 0,
    },
  };
}

/** Rândurile unei granularități, cele mai recente întâi. */
function bucketsFor(rows: PeriodRow[], period: StatsPeriod, limit: number): PeriodTotals[] {
  return rows
    .filter((row) => row.period === period)
    .slice(0, limit)
    .map((row) => ({
      key: row.key,
      label: periodLabelFromKey(row.key, period),
      salesCount: row.sales_count,
      quantity: row.quantity,
      revenueLei: row.revenue_lei,
      costLei: row.cost_lei,
      profitLei: row.revenue_lei - row.cost_lei,
    }));
}

export type StatsData = Awaited<ReturnType<typeof getStatsData>>;
