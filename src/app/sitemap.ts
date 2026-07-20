import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { buildCatalogSitemap } from "@/lib/vitrina/sitemap";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brands, modelRows, products] = await Promise.all([
    prisma.brand.findMany({ select: { name: true, updatedAt: true } }),
    prisma.carModel.findMany({
      select: {
        name: true,
        updatedAt: true,
        brand: { select: { name: true } },
      },
    }),
    prisma.product.findMany({ select: { id: true, updatedAt: true } }),
  ]);

  return buildCatalogSitemap(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    brands,
    modelRows.map((model) => ({
      name: model.name,
      brandName: model.brand.name,
      updatedAt: model.updatedAt,
    })),
    products,
  );
}
