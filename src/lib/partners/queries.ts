import { prisma } from "@/lib/prisma";
import { getPartnerBalances } from "@/lib/partners/debt";

/** All partners — suppliers and customers alike; the table shows the kind. */
export async function getPartnersData() {
  const [partners, balances] = await Promise.all([
    prisma.partner.findMany({
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
