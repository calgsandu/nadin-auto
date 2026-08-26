import { prisma } from "@/lib/prisma";
import { getPartnerBalances } from "@/lib/partners/debt";

/**
 * Furnizorii. Clienții au secțiunea lor („Clienți"), cu cumpărături și discount;
 * un partener BOTH apare în amândouă, pentru că chiar e și una și alta.
 */
export async function getPartnersData() {
  const [partners, balances] = await Promise.all([
    prisma.partner.findMany({
      where: { kind: { in: ["SUPPLIER", "BOTH"] } },
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true, paymentAccounts: true } } },
    }),
    getPartnerBalances(),
  ]);

  return {
    partners: partners.map((partner) => ({
      ...partner,
      balanceLei: balances.get(partner.id) ?? 0,
    })),
  };
}

export type PartnersData = Awaited<ReturnType<typeof getPartnersData>>;
export type PartnerRow = PartnersData["partners"][number];
