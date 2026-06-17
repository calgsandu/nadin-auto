import { prisma } from "@/lib/prisma";

/** Recent stock documents (receptii / vanzari / transferuri / ajustari) with their lines. */
export async function getDocumentsData() {
  const documents = await prisma.stockDocument.findMany({
    orderBy: [{ documentDate: "desc" }, { number: "desc" }],
    take: 100,
    include: {
      warehouse: true,
      partner: true,
      _count: { select: { lines: true } },
      lines: { include: { product: true }, take: 200 },
    },
  });
  return { documents };
}

export type DocumentsData = Awaited<ReturnType<typeof getDocumentsData>>;
export type DocumentRow = DocumentsData["documents"][number];
