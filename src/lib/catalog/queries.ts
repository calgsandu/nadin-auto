import { prisma } from "@/lib/prisma";
import { findMatchingProductIds } from "@/lib/catalog/product-match";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Filtrele catalogului. Restul secțiunilor și-au primit ruta proprie, deci
 * fiecare își declară singură parametrii — aici rămân doar cei ai catalogului.
 */
export type CatalogSearchParams = {
  q?: string;
  brand?: string;
  model?: string;
  type?: string;
  year?: string;
  page?: string;
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
  const query = params.q?.trim() ?? "";
  const matchedIds = query ? await findMatchingProductIds(query) : null;
  const baseWhere = buildProductWhere(params, matchedIds);
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
    warehouses,
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
        productFitments: {
          include: {
            fitment: {
              include: {
                carModel: { include: { brand: true } },
              },
            },
          },
        },
        warehouseStocks: {
          select: {
            warehouseId: true,
            quantity: true,
            warehouse: { select: { name: true } },
          },
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
    prisma.warehouse.findMany({
      where: { active: true },
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
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
    },
    brands,
    models,
    types,
    warehouses,
  };
}

function normalizePage(page: string | undefined) {
  const value = Number(page ?? 1);

  if (!Number.isInteger(value) || value < 1) {
    return 1;
  }

  return value;
}

/**
 * `matchedIds` vine din `findMatchingProductIds` (cod fără spații + termeni fără
 * diacritice); e null când căutarea nu e folosită.
 */
export function buildProductWhere(
  params: CatalogSearchParams,
  matchedIds: string[] | null = null,
): Prisma.ProductWhereInput {
  const filters: Prisma.ProductWhereInput[] = [];
  const year = params.year ? Number(params.year) : null;

  if (matchedIds) {
    filters.push({ id: { in: matchedIds } });
  }

  if (params.brand) {
    filters.push(compatibleFitmentFilter({ carModel: { brandId: params.brand } }));
  }

  if (params.model) {
    filters.push(compatibleFitmentFilter({ carModelId: params.model }));
  }

  if (params.type) {
    filters.push({ typeId: params.type });
  }

  if (year && Number.isInteger(year)) {
    filters.push(
      compatibleFitmentFilter({
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
      }),
    );
  }

  return filters.length > 0 ? { AND: filters } : {};
}

function compatibleFitmentFilter(
  fitment: Prisma.VehicleFitmentWhereInput,
): Prisma.ProductWhereInput {
  return {
    OR: [
      { fitment },
      { productFitments: { some: { fitment } } },
    ],
  };
}
