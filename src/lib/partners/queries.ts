import { prisma } from "@/lib/prisma";

/** All partners — suppliers and customers alike; the table shows the kind. */
export async function getPartnersData() {
  const partners = await prisma.partner.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { documents: true, paymentAccounts: true } } },
  });

  return { partners };
}

export type PartnersData = Awaited<ReturnType<typeof getPartnersData>>;
export type PartnerRow = PartnersData["partners"][number];
