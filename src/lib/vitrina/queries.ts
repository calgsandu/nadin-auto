import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/vitrina/slug";
import { displayName } from "@/lib/vitrina/display-name";
import {
  catalogCopy,
  localizedValue,
  type CatalogLocale,
} from "@/lib/vitrina/i18n";

export type ShowroomBrand = {
  name: string;
  slug: string;
  modelCount: number;
  productCount: number;
};

export type ShowroomType = {
  name: string;
  sourceName: string;
  slug: string;
  count: number;
};

export type ShowroomData = {
  totals: { products: number; brands: number; models: number; types: number };
  brands: ShowroomBrand[];
  types: ShowroomType[];
};

export const getShowroomData = cache(async (locale: CatalogLocale = "ro"): Promise<ShowroomData> => {
  const [brandRows, typeRows, productCount, modelCount] = await Promise.all([
    prisma.$queryRaw<
      { id: string; name: string; models: bigint; products: bigint }[]
    >`
      SELECT b.id, b.name,
        COUNT(DISTINCT cm.id) AS models,
        COUNT(DISTINCT pf."productId") AS products
      FROM "Brand" b
      LEFT JOIN "CarModel" cm ON cm."brandId" = b.id
      LEFT JOIN "VehicleFitment" vf ON vf."carModelId" = cm.id
      LEFT JOIN "ProductFitment" pf ON pf."fitmentId" = vf.id
      GROUP BY b.id, b.name
      ORDER BY products DESC, b.name ASC
    `,
    prisma.productType.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { products: { _count: "desc" } },
    }),
    prisma.product.count(),
    prisma.carModel.count(),
  ]);

  const brands = brandRows
    .filter((row) => Number(row.products) > 0)
    .map((row) => ({
      name: displayName(row.name),
      slug: slugify(row.name),
      modelCount: Number(row.models),
      productCount: Number(row.products),
    }));

  const types = typeRows
    .filter((type) => type._count.products > 0)
    .map((type) => ({
      name: localizedValue(locale, type.name, type.nameRu),
      sourceName: type.name,
      slug: slugify(type.name),
      count: type._count.products,
    }));

  return {
    totals: {
      products: productCount,
      brands: brands.length,
      models: modelCount,
      types: types.length,
    },
    brands,
    types,
  };
});

/**
 * Codurile pieselor din fiecare categorie (după numele din baza de date), ca
 * prima pagină să-și aleagă pentru fiecare categorie o poză reală de piesă.
 */
export const getTypeSampleCodes = cache(async (): Promise<Map<string, string[]>> => {
  const rows = await prisma.product.findMany({
    where: { externalCode: { not: null } },
    select: { externalCode: true, type: { select: { name: true } } },
    orderBy: { description: "asc" },
  });
  const codes = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.externalCode) continue;
    const list = codes.get(row.type.name) ?? [];
    list.push(row.externalCode);
    codes.set(row.type.name, list);
  }
  return codes;
});

export type PopularModel = {
  brand: string;
  brandSlug: string;
  name: string;
  slug: string;
  productCount: number;
  years: string | null;
};

/** Modelele cu cele mai multe piese, pentru vitrina de pe prima pagină. */
export const getPopularModels = cache(
  async (locale: CatalogLocale = "ro", limit = 12): Promise<PopularModel[]> => {
    const rows = await prisma.$queryRaw<
      {
        brand: string;
        model: string;
        products: bigint;
        y0: number | null;
        y1: number | null;
        open: boolean | null;
      }[]
    >`
      SELECT b.name AS brand, cm.name AS model,
        COUNT(DISTINCT pf."productId") AS products,
        MIN(vf."yearStart") AS y0,
        MAX(vf."yearEnd") AS y1,
        BOOL_OR(vf."yearOpenEnded") AS open
      FROM "CarModel" cm
      JOIN "Brand" b ON b.id = cm."brandId"
      JOIN "VehicleFitment" vf ON vf."carModelId" = cm.id
      JOIN "ProductFitment" pf ON pf."fitmentId" = vf.id
      GROUP BY b.name, cm.name
      ORDER BY products DESC, cm.name ASC
      LIMIT ${limit}
    `;
    const copy = catalogCopy(locale).common;
    return rows.map((row) => {
      let years: string | null = null;
      if (row.y0 != null) {
        const to = row.open ? copy.present : row.y1 != null ? String(row.y1) : null;
        years = to ? `${row.y0} – ${to}` : copy.fromYear(row.y0);
      }
      return {
        brand: displayName(row.brand),
        brandSlug: slugify(row.brand),
        name: displayName(row.model),
        slug: slugify(row.model),
        productCount: Number(row.products),
        years,
      };
    });
  },
);

export type VehicleIndexBrand = {
  name: string;
  slug: string;
  models: { name: string; slug: string }[];
};

/** Mărcile și modelele care au piese, pentru selectorul „Marcă → Model” din hero. */
export const getVehicleIndex = cache(async (): Promise<VehicleIndexBrand[]> => {
  const rows = await prisma.$queryRaw<{ brand: string; model: string }[]>`
    SELECT DISTINCT b.name AS brand, cm.name AS model
    FROM "CarModel" cm
    JOIN "Brand" b ON b.id = cm."brandId"
    JOIN "VehicleFitment" vf ON vf."carModelId" = cm.id
    JOIN "ProductFitment" pf ON pf."fitmentId" = vf.id
  `;
  const brands = new Map<string, VehicleIndexBrand>();
  for (const row of rows) {
    const slug = slugify(row.brand);
    if (!brands.has(slug)) brands.set(slug, { name: displayName(row.brand), slug, models: [] });
    brands.get(slug)!.models.push({ name: displayName(row.model), slug: slugify(row.model) });
  }
  const collator = new Intl.Collator("ro", { numeric: true, sensitivity: "base" });
  return [...brands.values()]
    .map((brand) => ({
      ...brand,
      models: brand.models.sort((a, b) => collator.compare(a.name, b.name)),
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
});

export type BrandModel = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  years: string | null;
};

export const getBrandData = cache(async (brandSlug: string, locale: CatalogLocale = "ro") => {
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brand = brands.find((entry) => slugify(entry.name) === brandSlug);
  if (!brand) return null;

  const models = await prisma.carModel.findMany({
    where: { brandId: brand.id },
    include: {
      fitments: {
        select: {
          yearStart: true,
          yearEnd: true,
          yearOpenEnded: true,
          productFitments: { select: { productId: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const entries: BrandModel[] = models
    .map((model) => {
      const productCount = new Set(
        model.fitments.flatMap((fitment) => fitment.productFitments.map((entry) => entry.productId)),
      ).size;
      const starts = model.fitments
        .map((fitment) => fitment.yearStart)
        .filter((year): year is number => year != null);
      const ends = model.fitments
        .map((fitment) => fitment.yearEnd)
        .filter((year): year is number => year != null);
      const open = model.fitments.some((fitment) => fitment.yearOpenEnded);
      let years: string | null = null;
      if (starts.length > 0) {
        const from = Math.min(...starts);
        const copy = catalogCopy(locale).common;
        const to = open ? copy.present : ends.length > 0 ? String(Math.max(...ends)) : null;
        years = to ? `${from} – ${to}` : copy.fromYear(from);
      }
      return {
        id: model.id,
        name: displayName(model.name),
        slug: slugify(model.name),
        productCount,
        years,
      };
    })
    .filter((entry) => entry.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));

  return { name: displayName(brand.name), slug: brandSlug, models: entries };
});

export type PublicProduct = {
  id: string;
  code: string | null;
  description: string;
  isLocal: boolean;
  fitLabel: string;
};

type LocalizablePublicProductRow = {
  id: string;
  externalCode: string | null;
  description: string;
  descriptionRu: string | null;
  isLocal: boolean;
  fitment: { label: string; labelRu: string | null };
};

export function localizePublicProduct(
  product: LocalizablePublicProductRow,
  locale: CatalogLocale,
): PublicProduct {
  return {
    id: product.id,
    code: product.externalCode,
    description: localizedValue(locale, product.description, product.descriptionRu),
    isLocal: product.isLocal,
    fitLabel: localizedValue(locale, product.fitment.label, product.fitment.labelRu),
  };
}

export type ModelTypeGroup = { type: string; slug: string; products: PublicProduct[] };

export const getModelData = cache(
  async (brandSlug: string, modelSlug: string, locale: CatalogLocale = "ro") => {
    const brand = await getBrandData(brandSlug, locale);
    if (!brand) return null;
    const modelEntry = brand.models.find((model) => model.slug === modelSlug);
    if (!modelEntry) return null;

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { fitment: { carModelId: modelEntry.id } },
          { productFitments: { some: { fitment: { carModelId: modelEntry.id } } } },
        ],
      },
      include: { type: true, fitment: true, productFitments: { include: { fitment: true } } },
      orderBy: [{ type: { name: "asc" } }, { description: "asc" }],
    });

    const groups = new Map<string, ModelTypeGroup>();
    for (const product of products) {
      const key = product.type.name;
      if (!groups.has(key)) {
        groups.set(key, {
          type: localizedValue(locale, key, product.type.nameRu),
          slug: slugify(key),
          products: [],
        });
      }
      const selectedFitment =
        product.productFitments.find((entry) => entry.fitment.carModelId === modelEntry.id)
          ?.fitment ?? product.fitment;
      groups.get(key)!.products.push(
        localizePublicProduct({ ...product, fitment: selectedFitment }, locale),
      );
    }

    return {
      brand: { name: brand.name, slug: brandSlug },
      model: { name: modelEntry.name, slug: modelSlug, years: modelEntry.years },
      groups: [...groups.values()].sort(
        (a, b) => b.products.length - a.products.length,
      ),
    };
  },
);

export type ProductDetails = {
  id: string;
  code: string | null;
  description: string;
  notes: string | null;
  isLocal: boolean;
  type: string;
  typeSource: string;
  fitLabel: string;
  years: string | null;
  brand: { name: string; slug: string };
  model: { name: string; slug: string };
  related: (PublicProduct & { type: string })[];
};

export const getProductDetails = cache(
  async (id: string, locale: CatalogLocale = "ro"): Promise<ProductDetails | null> => {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        type: true,
        fitment: { include: { carModel: { include: { brand: true } } } },
      },
    });
    if (!product) return null;

    const fitment = product.fitment;
    const carModel = fitment.carModel;
    let years: string | null = null;
    if (fitment.yearStart != null) {
      const copy = catalogCopy(locale).common;
      const to = fitment.yearOpenEnded
        ? copy.present
        : fitment.yearEnd != null
          ? String(fitment.yearEnd)
          : null;
      years = to ? `${fitment.yearStart} – ${to}` : copy.fromYear(fitment.yearStart);
    }

    const sameType = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        OR: [
          { fitment: { carModelId: carModel.id } },
          { productFitments: { some: { fitment: { carModelId: carModel.id } } } },
        ],
        typeId: product.typeId,
      },
      include: { type: true, fitment: true },
      orderBy: { description: "asc" },
      take: 6,
    });
    const fill =
      sameType.length < 6
        ? await prisma.product.findMany({
            where: {
              id: { notIn: [product.id, ...sameType.map((entry) => entry.id)] },
              OR: [
                { fitment: { carModelId: carModel.id } },
                { productFitments: { some: { fitment: { carModelId: carModel.id } } } },
              ],
            },
            include: { type: true, fitment: true },
            orderBy: { description: "asc" },
            take: 6 - sameType.length,
          })
        : [];
    const related = [...sameType, ...fill];

    return {
      id: product.id,
      code: product.externalCode,
      description: localizedValue(locale, product.description, product.descriptionRu),
      notes:
        locale === "ru"
          ? product.notesRu?.trim() || product.notes
          : product.notes,
      isLocal: product.isLocal,
      type: localizedValue(locale, product.type.name, product.type.nameRu),
      typeSource: product.type.name,
      fitLabel: localizedValue(locale, fitment.label, fitment.labelRu),
      years,
      brand: { name: displayName(carModel.brand.name), slug: slugify(carModel.brand.name) },
      model: { name: displayName(carModel.name), slug: slugify(carModel.name) },
      related: related.map((entry) => ({
        ...localizePublicProduct(entry, locale),
        type: localizedValue(locale, entry.type.name, entry.type.nameRu),
      })),
    };
  },
);

export type SearchHit = PublicProduct & {
  type: string;
  brand: string;
  brandSlug: string;
  model: string;
  modelSlug: string;
};

export async function searchPublicProducts(
  query: string,
  locale: CatalogLocale = "ro",
): Promise<SearchHit[]> {
  const terms = query.trim().split(/\s+/).filter((term) => term.length >= 2);
  if (terms.length === 0) return [];
  const products = await prisma.product.findMany({
    where: {
      AND: terms.map((term) => ({
        OR: [
          { description: { contains: term, mode: "insensitive" as const } },
          { descriptionRu: { contains: term, mode: "insensitive" as const } },
          { externalCode: { contains: term, mode: "insensitive" as const } },
          { type: { name: { contains: term, mode: "insensitive" as const } } },
          { type: { nameRu: { contains: term, mode: "insensitive" as const } } },
          { fitment: { label: { contains: term, mode: "insensitive" as const } } },
          { fitment: { labelRu: { contains: term, mode: "insensitive" as const } } },
          {
            fitment: {
              carModel: { name: { contains: term, mode: "insensitive" as const } },
            },
          },
          {
            productFitments: {
              some: {
                fitment: {
                  carModel: { name: { contains: term, mode: "insensitive" as const } },
                },
              },
            },
          },
          {
            fitment: {
              carModel: {
                brand: { name: { contains: term, mode: "insensitive" as const } },
              },
            },
          },
          {
            productFitments: {
              some: {
                fitment: {
                  carModel: {
                    brand: { name: { contains: term, mode: "insensitive" as const } },
                  },
                },
              },
            },
          },
        ],
      })),
    },
    include: { type: true, fitment: { include: { carModel: { include: { brand: true } } } } },
    orderBy: { description: "asc" },
    take: 80,
  });
  return products.map((product) => ({
    ...localizePublicProduct(product, locale),
    type: localizedValue(locale, product.type.name, product.type.nameRu),
    brand: displayName(product.fitment.carModel.brand.name),
    brandSlug: slugify(product.fitment.carModel.brand.name),
    model: displayName(product.fitment.carModel.name),
    modelSlug: slugify(product.fitment.carModel.name),
  }));
}
