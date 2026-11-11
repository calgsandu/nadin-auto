import { prisma } from "@/lib/prisma";
import { getPartnerBalances, getSupplierBalances } from "@/lib/partners/debt";
import { listMoneyAccounts } from "@/lib/finance/expenses";

/**
 * Furnizorii. Clienții au secțiunea lor („Clienți"), cu cumpărături și discount;
 * un partener BOTH apare în amândouă, pentru că chiar e și una și alta.
 */
export async function getPartnersData() {
  const [partners, balances, supplierBalances, accounts] = await Promise.all([
    prisma.partner.findMany({
      where: { kind: { in: ["SUPPLIER", "BOTH"] } },
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true, paymentAccounts: true } } },
    }),
    getPartnerBalances(),
    getSupplierBalances(),
    listMoneyAccounts(),
  ]);

  return {
    accounts,
    partners: partners.map((partner) => ({
      ...partner,
      balanceLei: balances.get(partner.id) ?? 0,
      /** Ce îi datorăm noi: recepții minus plăți. */
      supplierBalanceLei: supplierBalances.get(partner.id) ?? 0,
    })),
  };
}

export type PartnersData = Awaited<ReturnType<typeof getPartnersData>>;
export type PartnerRow = PartnersData["partners"][number];
