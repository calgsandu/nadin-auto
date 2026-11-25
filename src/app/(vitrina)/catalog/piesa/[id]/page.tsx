import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductDetails } from "@/lib/vitrina/queries";
import { productImage } from "@/lib/vitrina/images";
import { Reveal, StaggerGroup } from "../../motion";
import { PartCard, PartPlaceholder, StockBadge } from "../../part-card";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, locale] = await Promise.all([params, getRequestCatalogLocale()]);
  const product = await getProductDetails(id, locale);
  if (!product) return {};
  const suffix = `/piesa/${id}`;
  return {
    title: `${product.description} — Nadin Auto`,
    description: `${product.brand.name} ${product.model.name}, ${product.fitLabel}, cod ${product.code ?? product.type}`,
    alternates: {
      canonical: catalogHref(locale, suffix),
      languages: { ro: catalogHref("ro", suffix), ru: catalogHref("ru", suffix) },
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, locale] = await Promise.all([params, getRequestCatalogLocale()]);
  const copy = catalogCopy(locale);
  const product = await getProductDetails(id, locale);
  if (!product) notFound();

  const realImage = productImage(product.code);
  const modelHref = catalogHref(locale, `/${product.brand.slug}/${product.model.slug}`);

  const specs: [string, ReactNode][] = [
    [copy.product.car, `${product.brand.name} ${product.model.name}`],
    [copy.product.years, product.years ?? copy.common.allYears],
    [copy.product.compatibility, product.fitLabel],
    [copy.product.category, product.type],
  ];
  if (product.notes) specs.push([copy.product.notes, product.notes]);

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-28 md:pt-32">
        <Reveal>
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-(--c-muted)">
            <Link href={catalogHref(locale)} className="transition-colors hover:text-(--c-ink)">
              {copy.common.catalog}
            </Link>
            <span aria-hidden className="text-(--c-faint)">/</span>
            <Link
              href={catalogHref(locale, `/${product.brand.slug}`)}
              className="transition-colors hover:text-(--c-ink)"
            >
              {product.brand.name}
            </Link>
            <span aria-hidden className="text-(--c-faint)">/</span>
            <Link href={modelHref} className="transition-colors hover:text-(--c-ink)">
              {product.model.name}
            </Link>
          </nav>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-8 md:mt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <Reveal className="relative">
            <div
              className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] border border-(--c-line) bg-white"
            >
              {realImage ? (
                <Image
                  src={realImage}
                  alt={product.description}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain p-6 md:p-10"
                />
              ) : (
                <PartPlaceholder locale={locale} />
              )}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="text-[1.75rem] font-medium leading-tight tracking-tight md:text-[2.5rem]">
              {product.description}
            </h1>
            <p className="mt-2 text-[15px] text-(--c-muted)">
              {copy.product.code} <span className="font-mono text-(--c-ink)">{product.code ?? "—"}</span>
            </p>
            <StockBadge
              locale={locale}
              inStock={product.inStock}
              isLocal={product.isLocal}
              size="md"
              className="mt-3"
            />

            <dl className="mt-6 divide-y divide-(--c-line) rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) text-[15px]">
              {specs.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 px-5 py-3.5">
                  <dt className="shrink-0 text-(--c-muted)">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={modelHref}
                className="rounded-full bg-(--c-accent) px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-(--c-accent-hover)"
              >
                {copy.product.allPartsFor(product.model.name)}
              </Link>
              <Link
                href={catalogHref(locale, "/cauta")}
                className="rounded-full border border-(--c-line-strong) bg-(--c-surface) px-6 py-3 text-sm font-medium transition-colors hover:bg-(--c-hover)"
              >
                {copy.product.searchAnother}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {product.related.length > 0 ? (
        <section className="mx-auto max-w-6xl border-t border-(--c-line) px-6 pb-20 pt-12 md:pb-24">
          <Reveal>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-[1.375rem] font-medium tracking-tight md:text-2xl">
                {copy.product.otherPartsFor} {product.brand.name} {product.model.name}
              </h2>
              <Link
                href={modelHref}
                className="text-sm font-medium text-(--c-accent) transition-colors hover:text-(--c-accent-hover)"
              >
                {copy.common.all} →
              </Link>
            </div>
          </Reveal>
          <StaggerGroup className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {product.related.map((entry) => (
              <PartCard key={entry.id} locale={locale} part={entry} meta={entry.type} />
            ))}
          </StaggerGroup>
        </section>
      ) : null}
    </>
  );
}
