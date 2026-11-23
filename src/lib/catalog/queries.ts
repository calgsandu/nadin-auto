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
  /** Varianta modelului (anii), ca pasul 3 de la Polcar. */
  fitment?: string;
  type?: string;
  year?: string;
  /** "1" = doar produsele cu stoc; "ok" = peste pragul minim; "mic" = aproape terminate (de comandat); "0" = fără stoc. */
  stoc?: string;
  /** "0" = fără preț de vânzare (de completat). */
  pret?: string;
  page?: string;
};

const PAGE_SIZE = 100;

/**
 * „Aproape terminat": mai sunt câteva bucăți, dar cel mult pragul din fișă
 * (stocul minim, implicit 3). Cele la zero au lista lor („Fără stoc").
 */
export const lowStockWhere: Prisma.ProductWhereInput = {
  stock: { gt: 0 },
  OR: [
    { minStock: null, stock: { lte: 3 } },
    { stock: { lte: prisma.product.fields.minStock } },
  ],
};

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
  const stockFilter: Prisma.ProductWhereInput[] = [];
  if (options.onlyInStock || params.stoc === "1") stockFilter.push({ stock: { gt: 0 } });
  if (params.stoc === "mic") stockFilter.push(lowStockWhere);
  if (params.stoc === "ok") {
    stockFilter.push({
      OR: [
        { minStock: null, stock: { gt: 3 } },
        { minStock: { not: null }, stock: { gt: prisma.product.fields.minStock } },
      ],
    });
  }
  if (params.stoc === "0") stockFilter.push({ OR: [{ stock: null }, { stock: { lte: 0 } }] });
  if (params.pret === "0") stockFilter.push({ salePriceLei: null });
  const withStock = (base: Prisma.ProductWhereInput): Prisma.ProductWhereInput =>
    stockFilter.length > 0 ? { AND: [base, ...stockFilter] } : base;
  const where = withStock(buildProductWhere(params, matchedIds));
  const page = normalizePage(params.page);
  const skip = (page - 1) * PAGE_SIZE;

  const [
    products,
    productCount,
    brands,
    models,
    types,
    warehouses,
    fitments,
    stockSummary,
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
      // Alfabetic în mașină: marcă → model → anii → denumire. Ordinea din pricelist
      // (sourceRow) punea „Panou spate colț" înaintea „Arca față".
      // ponytail: collation C a bazei; singurele descrieri care nu încep cu A–Z sunt
      // „Ș…" (toate pe modelul ȘTERGĂTOARE), deci nu e nevoie de collation ICU.
      orderBy: [
        { fitment: { carModel: { brand: { name: "asc" } } } },
        { fitment: { carModel: { name: "asc" } } },
        { fitment: { yearStart: "asc" } },
        { fitment: { label: "asc" } },
        { description: "asc" },
        { id: "asc" },
      ],
      skip,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
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
    params.model
      ? prisma.vehicleFitment.findMany({
          where: {
            carModelId: params.model,
            OR: [{ products: { some: {} } }, { productFitments: { some: {} } }],
          },
          orderBy: [{ yearStart: "asc" }, { yearEnd: "asc" }],
        })
      : [],
    getStockSummary(),
  ]);

  return {
    products,
    productCount,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.max(Math.ceil(productCount / PAGE_SIZE), 1),
    },
    params: {
      q: params.q,
      brand: params.brand,
      model: params.model,
      fitment: params.fitment,
      type: params.type,
      year: params.year,
      stoc: params.stoc,
      pret: params.pret,
    },
    brands,
    models,
    types,
    warehouses,
    fitments,
    stockSummary,
  };
}

/**
 * Cifrele din capul paginii Produse, pe tot catalogul: câte piese sunt în stoc,
 * aproape terminate (același prag ca `lowStockWhere`) și lipsă, plus valoarea
 * stocului la prețul de vânzare. Un singur dus-întors.
 */
async function getStockSummary() {
  const [row] = await prisma.$queryRaw<
    { total: number; out: number; low: number; pieces: number; value: number }[]
  >`
    SELECT
      count(*)::int AS total,
      (count(*) FILTER (WHERE COALESCE(stock, 0) <= 0))::int AS out,
      (count(*) FILTER (WHERE stock > 0 AND stock <= COALESCE("minStock", 3)))::int AS low,
      COALESCE(sum(GREATEST(COALESCE(stock, 0), 0)), 0)::int AS pieces,
      COALESCE(sum(GREATEST(COALESCE(stock, 0), 0) * COALESCE("salePriceLei", 0)), 0)::float8 AS value
    FROM "Product"
  `;
  return { ...row, inStock: row.total - row.out - row.low };
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

  if (params.fitment) {
    filters.push(compatibleFitmentFilter({ id: params.fitment }));
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
