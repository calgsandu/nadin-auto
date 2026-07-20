import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { StockDocumentType } from "@/generated/prisma/enums";

export type DocumentsSearchParams = {
  /** Tip document: RECEIPT / SALE / RETURN / ADJUSTMENT. */
  dtype?: string;
  /** Filtru partener (id). */
  partner?: string;
  /** Interval de date (YYYY-MM-DD). */
  from?: string;
  to?: string;
  /** Pagina curentă. */
  dpage?: string;
};

const PAGE_SIZE = 50;
const TYPES = new Set(["RECEIPT", "SALE", "RETURN", "ADJUSTMENT"]);

function parseDay(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Documente de stoc cu filtre (tip/partener/dată) și paginare. */
export async function getDocumentsData(params: DocumentsSearchParams = {}) {
  const where: Prisma.StockDocumentWhereInput = {};
  const dtype = params.dtype && TYPES.has(params.dtype) ? (params.dtype as StockDocumentType) : undefined;
  if (dtype) where.type = dtype;
  if (params.partner) where.partnerId = params.partner;

  const from = parseDay(params.from);
  const toDay = parseDay(params.to);
  if (from || toDay) {
    const to = toDay ? new Date(toDay.getTime() + 24 * 60 * 60 * 1000 - 1) : undefined;
    where.documentDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  }

  const pageRaw = Number(params.dpage ?? 1);
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const [documents, total, partners] = await Promise.all([
    prisma.stockDocument.findMany({
      where,
      orderBy: [{ documentDate: "desc" }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        warehouse: true,
        partner: true,
        _count: { select: { lines: true } },
        lines: { include: { product: { include: { fitment: { include: { carModel: { include: { brand: true } } } } } } }, take: 200 },
      },
    }),
    prisma.stockDocument.count({ where }),
    prisma.partner.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    documents,
    total,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(Math.ceil(total / PAGE_SIZE), 1),
    partners,
    filters: {
      dtype: dtype ?? "",
      partner: params.partner ?? "",
      from: params.from ?? "",
      to: params.to ?? "",
    },
  };
}

export type DocumentsData = Awaited<ReturnType<typeof getDocumentsData>>;
export type DocumentRow = DocumentsData["documents"][number];
