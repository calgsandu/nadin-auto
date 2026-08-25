import { prisma } from "@/lib/prisma";
import { COMPANY, vatFromGross } from "@/lib/company";

type MonthRow = {
  key: string;
  sales_gross: number;
  sales_count: number;
  returns_gross: number;
  returns_count: number;
  invoices_gross: number;
  invoices_net: number;
  invoices_vat: number;
  invoices_count: number;
};

export type VatMonth = {
  key: string;
  label: string;
  salesCount: number;
  salesGross: number;
  salesNet: number;
  salesVat: number;
  returnsCount: number;
  returnsGross: number;
  returnsVat: number;
  netVat: number;
  invoicesCount: number;
  invoicesGross: number;
  invoicesVat: number;
};

const monthLabelFormat = new Intl.DateTimeFormat("ro-MD", {
  month: "long",
  year: "numeric",
});

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Registrul TVA pe luni. Prețurile sunt cu TVA inclus, deci TVA = brut ÷ 6 la
 * cota de 20% — aceeași formulă ca pe facturi (`vatFromGross`).
 *
 * Facturile (conturile de plată) sunt un SUBSET al vânzărilor, nu se adună la
 * ele: coloanele lor arată cât din cifra lunii a plecat cu document fiscal.
 */
export async function getVatReportData(months = 12) {
  const from = new Date();
  from.setMonth(from.getMonth() - (months - 1));
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const rows = await prisma.$queryRaw<MonthRow[]>`
    WITH months AS (
      SELECT to_char(generate_series(${from}::timestamp, now(), interval '1 month'), 'YYYY-MM') AS key
    ),
    docs AS (
      SELECT to_char("documentDate", 'YYYY-MM') AS key,
             type,
             COALESCE("totalLei", "totalEuro", 0) AS gross
      FROM "StockDocument"
      WHERE "documentDate" >= ${from} AND type IN ('SALE', 'RETURN')
    ),
    invoices AS (
      SELECT to_char("issueDate", 'YYYY-MM') AS key,
             "totalGross", "totalNet", "totalVat"
      FROM "PaymentAccount"
      WHERE "issueDate" >= ${from} AND status = 'ISSUED'
    )
    SELECT m.key,
           COALESCE(SUM(d.gross) FILTER (WHERE d.type = 'SALE'), 0)::float8 AS sales_gross,
           COUNT(*) FILTER (WHERE d.type = 'SALE')::int AS sales_count,
           COALESCE(SUM(d.gross) FILTER (WHERE d.type = 'RETURN'), 0)::float8 AS returns_gross,
           COUNT(*) FILTER (WHERE d.type = 'RETURN')::int AS returns_count,
           COALESCE((SELECT SUM(i."totalGross") FROM invoices i WHERE i.key = m.key), 0)::float8 AS invoices_gross,
           COALESCE((SELECT SUM(i."totalNet") FROM invoices i WHERE i.key = m.key), 0)::float8 AS invoices_net,
           COALESCE((SELECT SUM(i."totalVat") FROM invoices i WHERE i.key = m.key), 0)::float8 AS invoices_vat,
           COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.key = m.key), 0)::int AS invoices_count
    FROM months m
    LEFT JOIN docs d ON d.key = m.key
    GROUP BY m.key
    ORDER BY m.key DESC`;

  const split = (gross: number) =>
    COMPANY.vatPayer ? vatFromGross(gross) : { tva: 0, net: gross };

  const monthsData: VatMonth[] = rows.map((row) => {
    const sales = split(row.sales_gross);
    const salesVat = sales.tva;
    const returnsVat = split(row.returns_gross).tva;

    return {
      key: row.key,
      label: monthLabel(row.key),
      salesCount: row.sales_count,
      salesGross: row.sales_gross,
      salesNet: sales.net,
      salesVat,
      returnsCount: row.returns_count,
      returnsGross: row.returns_gross,
      returnsVat,
      netVat: round(salesVat - returnsVat),
      invoicesCount: row.invoices_count,
      invoicesGross: row.invoices_gross,
      invoicesVat: row.invoices_vat,
    };
  });

  return {
    vatPayer: COMPANY.vatPayer,
    vatRate: COMPANY.vatRate,
    months: monthsData,
    totals: {
      salesGross: round(monthsData.reduce((sum, month) => sum + month.salesGross, 0)),
      salesVat: round(monthsData.reduce((sum, month) => sum + month.salesVat, 0)),
      returnsVat: round(monthsData.reduce((sum, month) => sum + month.returnsVat, 0)),
      netVat: round(monthsData.reduce((sum, month) => sum + month.netVat, 0)),
      invoicesGross: round(monthsData.reduce((sum, month) => sum + month.invoicesGross, 0)),
    },
  };
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return monthLabelFormat.format(new Date(year, month - 1, 1));
}

export type VatReportData = Awaited<ReturnType<typeof getVatReportData>>;
