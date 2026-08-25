import { prisma } from "@/lib/prisma";

type Row = {
  partner_id: string | null;
  partner_name: string | null;
  sales_count: number;
  quantity: number;
  revenue_lei: number;
  cost_lei: number;
  last_sale: Date | null;
};

export type PartnerProfitRow = {
  partnerId: string | null;
  name: string;
  salesCount: number;
  quantity: number;
  revenueLei: number;
  costLei: number;
  profitLei: number;
  marginPercent: number | null;
  lastSale: Date | null;
};

/**
 * Cine aduce banii: venit, cost și profit pe client, pe ultimele `months` luni.
 * Vânzările fără partener (clientul de tejghea) se strâng într-un singur rând.
 */
export async function getPartnerProfitData(months = 12, limit = 30) {
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  from.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT d."partnerId" AS partner_id,
           MAX(pa.name) AS partner_name,
           COUNT(DISTINCT d.id)::int AS sales_count,
           COALESCE(SUM(l.quantity), 0)::int AS quantity,
           COALESCE(SUM(l.quantity * COALESCE(l."unitPriceEuro", 0)), 0)::float8 AS revenue_lei,
           COALESCE(SUM(l.quantity * CASE
             WHEN l."productId" IS NOT NULL THEN COALESCE(p."costLei", 0)
             ELSE COALESCE(l."unitCostLei", 0)
           END), 0)::float8 AS cost_lei,
           MAX(d."documentDate") AS last_sale
    FROM "StockDocument" d
    LEFT JOIN "StockDocumentLine" l ON l."documentId" = d.id
    LEFT JOIN "Product" p ON p.id = l."productId"
    LEFT JOIN "Partner" pa ON pa.id = d."partnerId"
    WHERE d.type = 'SALE' AND d."documentDate" >= ${from}
    GROUP BY d."partnerId"
    ORDER BY revenue_lei DESC
    LIMIT ${limit}`;

  return rows.map((row): PartnerProfitRow => {
    const profitLei = row.revenue_lei - row.cost_lei;
    return {
      partnerId: row.partner_id,
      name: row.partner_name ?? "Clienți de tejghea (fără partener)",
      salesCount: row.sales_count,
      quantity: row.quantity,
      revenueLei: row.revenue_lei,
      costLei: row.cost_lei,
      profitLei,
      marginPercent: row.revenue_lei > 0 ? (profitLei / row.revenue_lei) * 100 : null,
      lastSale: row.last_sale,
    };
  });
}

export type PartnerProfitData = Awaited<ReturnType<typeof getPartnerProfitData>>;
