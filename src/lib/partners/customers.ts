import { prisma } from "@/lib/prisma";
import { productLabelInclude } from "@/lib/catalog/product-include";
import { getPartnerBalances } from "@/lib/partners/debt";

/** Câte vânzări arată fișa clientului. Restul se caută în Documente. */
const PURCHASES_LIMIT = 30;

const CUSTOMER_KINDS = ["CUSTOMER", "BOTH"] as const;

type TotalsRow = {
  partnerId: string;
  boughtLei: number;
  lastPurchaseAt: Date | null;
  purchases: number;
};

/**
 * Cât a cumpărat fiecare client: vânzările lui minus retururile lor.
 *
 * Un singur SQL pentru toți — altfel lista de clienți ar face două interogări
 * pe rând, iar pagina ar sta pe zeci de round-trip-uri.
 */
async function getCustomerTotals(): Promise<Map<string, TotalsRow>> {
  const rows = await prisma.$queryRaw<TotalsRow[]>`
    SELECT s."partnerId" AS "partnerId",
           (COALESCE(SUM(s."totalLei"), 0) - COALESCE(SUM(r.returned), 0))::float8 AS "boughtLei",
           MAX(s."documentDate") AS "lastPurchaseAt",
           COUNT(*)::int AS purchases
      FROM "StockDocument" s
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(x."totalLei"), 0) AS returned
          FROM "StockDocument" x
         WHERE x.type = 'RETURN' AND x."sourceDocumentId" = s.id
      ) r ON TRUE
     WHERE s.type = 'SALE' AND s."partnerId" IS NOT NULL
     GROUP BY s."partnerId"
  `;

  return new Map(rows.map((row) => [row.partnerId, row]));
}

/** Lista clienților cu totalurile lor. `paidLei` = cumpărat − datorie. */
export async function getCustomersData() {
  const [customers, balances, totals] = await Promise.all([
    prisma.partner.findMany({
      where: { kind: { in: [...CUSTOMER_KINDS] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        kind: true,
        phone: true,
        email: true,
        address: true,
        idno: true,
        vatCode: true,
        iban: true,
        bankName: true,
        bankCode: true,
        notes: true,
        discountPercent: true,
      },
    }),
    getPartnerBalances(),
    getCustomerTotals(),
  ]);

  return {
    customers: customers.map((customer) => {
      const row = totals.get(customer.id);
      const boughtLei = round(row?.boughtLei ?? 0);
      const debtLei = balances.get(customer.id) ?? 0;
      return {
        ...customer,
        discountPercent:
          customer.discountPercent === null ? null : Number(customer.discountPercent),
        boughtLei,
        debtLei,
        paidLei: round(boughtLei - debtLei),
        purchases: row?.purchases ?? 0,
        lastPurchaseAt: row?.lastPurchaseAt ?? null,
      };
    }),
  };
}

/** Fișa unui client: ce a cumpărat, linie cu linie, plus încasările scrise. */
export async function getCustomerDetail(customerId: string) {
  const [sales, payments] = await Promise.all([
    prisma.stockDocument.findMany({
      where: { type: "SALE", partnerId: customerId },
      select: {
        id: true,
        number: true,
        documentDate: true,
        totalLei: true,
        paymentMethod: true,
        discountPercent: true,
        lines: {
          select: {
            id: true,
            quantity: true,
            // Coloana se numește `unitPriceEuro`, dar ține prețul liniei în lei
            // peste tot în aplicație. Numele e istoric, nu o altă monedă.
            unitPriceEuro: true,
            externalName: true,
            product: { include: productLabelInclude },
          },
        },
      },
      orderBy: { documentDate: "desc" },
      take: PURCHASES_LIMIT,
    }),
    prisma.partnerPayment.findMany({
      where: { partnerId: customerId },
      select: { id: true, amount: true, paidAt: true, notes: true },
      orderBy: { paidAt: "desc" },
      take: PURCHASES_LIMIT,
    }),
  ]);

  return { sales, payments };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export type CustomersData = Awaited<ReturnType<typeof getCustomersData>>;
export type CustomerRow = CustomersData["customers"][number];
export type CustomerDetail = Awaited<ReturnType<typeof getCustomerDetail>>;
