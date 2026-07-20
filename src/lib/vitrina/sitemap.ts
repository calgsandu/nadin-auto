import type { MetadataRoute } from "next";
import { catalogHref, type CatalogLocale } from "@/lib/vitrina/i18n";
import { slugify } from "@/lib/vitrina/slug";

type DatedName = { name: string; updatedAt: Date };
type ModelRow = DatedName & { brandName: string };
type ProductRow = { id: string; updatedAt: Date };

function absoluteUrl(siteUrl: string, path: string) {
  return new URL(path, `${siteUrl.replace(/\/$/, "")}/`).toString();
}

function localizedEntries(
  siteUrl: string,
  suffix: string,
  lastModified?: Date,
): MetadataRoute.Sitemap {
  const paths: Record<CatalogLocale, string> = {
    ro: catalogHref("ro", suffix),
    ru: catalogHref("ru", suffix),
  };
  const languages = {
    ro: absoluteUrl(siteUrl, paths.ro),
    ru: absoluteUrl(siteUrl, paths.ru),
  };

  return (["ro", "ru"] as const).map((locale) => ({
    url: languages[locale],
    lastModified,
    changeFrequency: "weekly" as const,
    alternates: { languages },
  }));
}

export function buildCatalogSitemap(
  siteUrl: string,
  brands: DatedName[],
  models: ModelRow[],
  products: ProductRow[],
): MetadataRoute.Sitemap {
  return [
    ...localizedEntries(siteUrl, ""),
    ...brands.flatMap((brand) =>
      localizedEntries(siteUrl, `/${slugify(brand.name)}`, brand.updatedAt),
    ),
    ...models.flatMap((model) =>
      localizedEntries(
        siteUrl,
        `/${slugify(model.brandName)}/${slugify(model.name)}`,
        model.updatedAt,
      ),
    ),
    ...products.flatMap((product) =>
      localizedEntries(siteUrl, `/piesa/${product.id}`, product.updatedAt),
    ),
  ];
}
