import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type CatalogSearchParams = {
  q?: string;
  brand?: string;
  model?: string;
  type?: string;
  year?: string;
  page?: string;
  section?: string;
  /** Selected warehouse for the inventory section. */
  wh?: string;
  /** Audit history: filter by document id. */
  doc?: string;
  /** Audit history: filter by action (CREATE/UPDATE/DELETE). */
  act?: string;
  /** Documents section: type / partner / date range / page. */
  dtype?: string;
  partner?: string;
  from?: string;
  to?: string;
  dpage?: string;
};

const PAGE_SIZE = 50;

export type CatalogOptions = {
  /** ANGAJAT vede doar produsele cu stoc pozitiv. */
  onlyInStock?: boolean;
};

export async function getCatalogData(
  params: CatalogSearchParams,
  options: CatalogOptions = {},
) {
  const baseWhere = buildProductWhere(params);
  const where: Prisma.ProductWhereInput = options.onlyInStock
    ? { AND: [baseWhere, { stock: { gt: 0 } }] }
    : baseWhere;
  const page = normalizePage(params.page);
  const skip = (page - 1) * PAGE_SIZE;

  const [
    products,
    productCount,
    editedProductCount,
    criticalStockCount,
    brands,
    models,
    types,
  ] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        type: true,
        fitment: {
          include: {
            carModel: {
              include: {
                brand: true,
              },
            },
          },
        },
        warehouseStocks: {
          where: { quantity: { not: 0 } },
          select: { quantity: true, warehouse: { select: { name: true } } },
          orderBy: { warehouse: { name: "asc" } },
        },
      },
      orderBy: [{ fitment: { carModel: { brand: { name: "asc" } } } }, { sourceRow: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    prisma.product.count({ where: { AND: [where, { manuallyEdited: true }] } }),
    // Sub pragul de alertă per produs (minStock, implicit 3).
    prisma.product.count({
      where: {
        AND: [
          where,
          {
            OR: [
              { stock: null },
              { AND: [{ minStock: null }, { stock: { lte: 3 } }] },
              { stock: { lte: prisma.product.fields.minStock } },
            ],
          },
        ],
      },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.carModel.findMany({
      where: params.brand ? { brandId: params.brand } : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.productType.findMany({ orderBy: { name: "asc" } }),
  ]);

  return {
    products,
    productCount,
    stats: {
      editedProductCount,
      criticalStockCount,
    },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.max(Math.ceil(productCount / PAGE_SIZE), 1),
    },
    params: {
      q: params.q,
      brand: params.brand,
      model: params.model,
      type: params.type,
      year: params.year,
      section: params.section,
    },
    brands,
    models,
    types,
  };
}

function normalizePage(page: string | undefined) {
  const value = Number(page ?? 1);

  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

function buildProductWhere(params: CatalogSearchParams): Prisma.ProductWhereInput {
  const filters: Prisma.ProductWhereInput[] = [];
  const q = params.q?.trim();
  const year = params.year ? Number(params.year) : null;

  if (q) {
    filters.push({
      OR: [
        { externalCode: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { fitment: { label: { contains: q, mode: "insensitive" } } },
        { fitment: { carModel: { name: { contains: q, mode: "insensitive" } } } },
        {
          fitment: {
            carModel: { brand: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      ],
    });
  }

  if (params.brand) {
    filters.push({
      fitment: {
        carModel: {
          brandId: params.brand,
        },
      },
    });
  }

  if (params.model) {
    filters.push({
      fitment: {
        carModelId: params.model,
      },
    });
  }

  if (params.type) {
    filters.push({ typeId: params.type });
  }

  if (year && Number.isInteger(year)) {
    filters.push({
      fitment: {
        AND: [
          { OR: [{ yearStart: null }, { yearStart: { lte: year } }] },
          {
            OR: [
              { yearEnd: null },
              { yearEnd: { gte: year } },
              { yearOpenEnded: true },
            ],
          },
        ],
      },
    });
  }

  return filters.length > 0 ? { AND: filters } : {};
}
