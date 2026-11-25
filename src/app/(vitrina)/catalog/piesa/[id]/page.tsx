import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductDetails } from "@/lib/vitrina/queries";
import { productImage } from "@/lib/vitrina/images";
import { LocalBadge } from "@/app/components/local-badge";
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
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-32 md:pt-40">
        <Reveal>
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-[#6f6a61]">
            <Link href={catalogHref(locale)} className="transition-colors hover:text-[#1b1a17]">
              {copy.common.catalog}
            </Link>
            <span aria-hidden className="text-[#b4afa5]">/</span>
            <Link
              href={catalogHref(locale, `/${product.brand.slug}`)}
              className="transition-colors hover:text-[#1b1a17]"
            >
              {product.brand.name}
            </Link>
            <span aria-hidden className="text-[#b4afa5]">/</span>
            <Link href={modelHref} className="transition-colors hover:text-[#1b1a17]">
              {product.model.name}
            </Link>
            <span aria-hidden className="text-[#b4afa5]">/</span>
            <span className="font-mono text-[#1b1a17]">{product.code ?? copy.product.part}</span>
          </nav>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-8 md:mt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <Reveal className="relative">
            <div
              className={`relative aspect-[4/3] overflow-hidden rounded-3xl border border-black/10 ${
                realImage ? "bg-white" : "bg-[#f1f0ec]"
              }`}
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
            <div className="flex flex-wrap items-center gap-2.5">
              <StockBadge locale={locale} inStock={product.inStock} size="md" />
              <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-[#57534a]">
                {product.type}
              </span>
              {product.isLocal ? <LocalBadge locale={locale} className="!text-[11px] px-3 py-1.5" /> : null}
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-[1.08] tracking-tight md:text-5xl">
              {product.description}
            </h1>
            <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2e90fa]/[0.08] px-3 py-1.5 font-mono text-lg font-semibold text-[#1570d6]">
              <span className="font-sans text-xs font-medium text-[#2e90fa]/80">{copy.product.code}</span>
              {product.code ?? "—"}
            </p>

            <dl className="mt-8 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white text-sm">
              {specs.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 px-5 py-3.5">
                  <dt className="shrink-0 text-[#6f6a61]">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={modelHref}
                className="rounded-full bg-[#2e90fa] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1b7fe8]"
              >
                {copy.product.allPartsFor(product.model.name)}
              </Link>
              <Link
                href={catalogHref(locale, "/cauta")}
                className="rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-semibold transition-colors hover:bg-black/5"
              >
                {copy.product.searchAnother}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {product.related.length > 0 ? (
        <section className="mx-auto max-w-6xl border-t border-black/10 px-6 pb-24 pt-14 md:pb-32">
          <Reveal>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                {copy.product.otherPartsFor} {product.brand.name} {product.model.name}
              </h2>
              <Link
                href={modelHref}
                className="text-sm font-semibold text-[#2e90fa] transition-colors hover:text-[#1b7fe8]"
              >
                {copy.common.all} →
              </Link>
            </div>
          </Reveal>
          <StaggerGroup className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {product.related.map((entry) => (
              <PartCard key={entry.id} locale={locale} part={entry} meta={entry.type} />
            ))}
          </StaggerGroup>
        </section>
      ) : null}
    </>
  );
}
