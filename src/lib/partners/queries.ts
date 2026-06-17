import { prisma } from "@/lib/prisma";

/** Suppliers = partners that can deliver goods (SUPPLIER or BOTH). */
export async function getPartnersData() {
  const partners = await prisma.partner.findMany({
    where: { kind: { in: ["SUPPLIER", "BOTH"] } },
    orderBy: { name: "asc" },
    include: { _count: { select: { documents: true } } },
  });

  return { partners };
}

export type PartnersData = Awaited<ReturnType<typeof getPartnersData>>;
export type PartnerRow = PartnersData["partners"][number];
