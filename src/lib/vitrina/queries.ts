import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/vitrina/slug";

export type ShowroomBrand = {
  name: string;
  slug: string;
  modelCount: number;
  productCount: number;
};

export type ShowroomType = { name: string; slug: string; count: number };

export type ShowroomData = {
  totals: { products: number; brands: number; models: number; types: number };
  brands: ShowroomBrand[];
  types: ShowroomType[];
};

export const getShowroomData = cache(async (): Promise<ShowroomData> => {
  const [brandRows, typeRows, productCount, modelCount] = await Promise.all([
    prisma.$queryRaw<
      { id: string; name: string; models: bigint; products: bigint }[]
    >`
      SELECT b.id, b.name,
        COUNT(DISTINCT cm.id) AS models,
        COUNT(p.id) AS products
      FROM "Brand" b
      LEFT JOIN "CarModel" cm ON cm."brandId" = b.id
      LEFT JOIN "VehicleFitment" vf ON vf."carModelId" = cm.id
      LEFT JOIN "Product" p ON p."fitmentId" = vf.id
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
      name: row.name,
      slug: slugify(row.name),
      modelCount: Number(row.models),
      productCount: Number(row.products),
    }));

  const types = typeRows
    .filter((type) => type._count.products > 0)
    .map((type) => ({
      name: type.name,
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

export type BrandModel = {
  name: string;
  slug: string;
  productCount: number;
  years: string | null;
};

export const getBrandData = cache(async (brandSlug: string) => {
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
          _count: { select: { products: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const entries: BrandModel[] = models
    .map((model) => {
      const productCount = model.fitments.reduce(
        (sum, fitment) => sum + fitment._count.products,
        0,
      );
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
        const to = open ? "prezent" : ends.length > 0 ? String(Math.max(...ends)) : null;
        years = to ? `${from} – ${to}` : `din ${from}`;
      }
      return { name: model.name, slug: slugify(model.name), productCount, years };
    })
    .filter((entry) => entry.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));

  return { name: brand.name, slug: brandSlug, models: entries };
});

export type PublicProduct = {
  id: string;
  code: string | null;
  description: string;
  inStock: boolean;
  fitLabel: string;
};

export type ModelTypeGroup = { type: string; slug: string; products: PublicProduct[] };

export const getModelData = cache(
  async (brandSlug: string, modelSlug: string) => {
    const brand = await getBrandData(brandSlug);
    if (!brand) return null;
    const modelEntry = brand.models.find((model) => model.slug === modelSlug);
    if (!modelEntry) return null;

    const products = await prisma.product.findMany({
      where: {
        fitment: {
          carModel: {
            name: modelEntry.name,
            brand: { name: brand.name },
          },
        },
      },
      include: { type: true, fitment: true },
      orderBy: [{ type: { name: "asc" } }, { description: "asc" }],
    });

    const groups = new Map<string, ModelTypeGroup>();
    for (const product of products) {
      const key = product.type.name;
      if (!groups.has(key)) {
        groups.set(key, { type: key, slug: slugify(key), products: [] });
      }
      groups.get(key)!.products.push({
        id: product.id,
        code: product.externalCode,
        description: product.description,
        inStock: (product.stock ?? 0) > 0,
        fitLabel: product.fitment.label,
      });
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

export type SearchHit = PublicProduct & {
  type: string;
  brand: string;
  brandSlug: string;
  model: string;
  modelSlug: string;
};

export async function searchPublicProducts(query: string): Promise<SearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { description: { contains: term, mode: "insensitive" } },
        { externalCode: { contains: term, mode: "insensitive" } },
        { fitment: { carModel: { name: { contains: term, mode: "insensitive" } } } },
        {
          fitment: {
            carModel: { brand: { name: { contains: term, mode: "insensitive" } } },
          },
        },
      ],
    },
    include: { type: true, fitment: { include: { carModel: { include: { brand: true } } } } },
    orderBy: { description: "asc" },
    take: 80,
  });
  return products.map((product) => ({
    id: product.id,
    code: product.externalCode,
    description: product.description,
    inStock: (product.stock ?? 0) > 0,
    fitLabel: product.fitment.label,
    type: product.type.name,
    brand: product.fitment.carModel.brand.name,
    brandSlug: slugify(product.fitment.carModel.brand.name),
    model: product.fitment.carModel.name,
    modelSlug: slugify(product.fitment.carModel.name),
  }));
}
