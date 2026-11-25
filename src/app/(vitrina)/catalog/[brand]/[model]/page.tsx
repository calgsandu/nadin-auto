import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getModelData } from "@/lib/vitrina/queries";
import { modelImage } from "@/lib/vitrina/images";
import { Reveal, StaggerGroup } from "../../motion";
import { PartCard } from "../../part-card";
import type { Metadata } from "next";
import {
  catalogCopy,
  catalogHref,
  catalogNumberFormat,
} from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string; model: string }>;
}): Promise<Metadata> {
  const [{ brand, model }, locale] = await Promise.all([
    params,
    getRequestCatalogLocale(),
  ]);
  const data = await getModelData(brand, model, locale);
  if (!data) return {};
  const suffix = `/${brand}/${model}`;
  return {
    title: locale === "ru"
      ? `${data.brand.name} ${data.model.name}: детали — Nadin Auto`
      : `${data.brand.name} ${data.model.name}: piese — Nadin Auto`,
    alternates: {
      canonical: catalogHref(locale, suffix),
      languages: { ro: catalogHref("ro", suffix), ru: catalogHref("ru", suffix) },
    },
  };
}

export default async function ModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string; model: string }>;
  searchParams: Promise<{ tip?: string; stoc?: string }>;
}) {
  const [{ brand: brandSlug, model: modelSlug }, { tip, stoc }, locale] = await Promise.all([
    params,
    searchParams,
    getRequestCatalogLocale(),
  ]);
  const copy = catalogCopy(locale);
  const numberFormat = catalogNumberFormat(locale);
  const data = await getModelData(brandSlug, modelSlug, locale);
  if (!data) notFound();

  const onlyInStock = stoc === "1";
  const allProducts = data.groups.flatMap((group) => group.products);
  const total = allProducts.length;
  const inStockTotal = allProducts.filter((product) => product.inStock).length;
  const countFor = (products: { inStock: boolean }[]) =>
    onlyInStock ? products.filter((product) => product.inStock).length : products.length;
  const activeGroups = data.groups
    .filter((group) => !tip || group.slug === tip)
    .map((group) => ({
      ...group,
      products: onlyInStock ? group.products.filter((product) => product.inStock) : group.products,
    }))
    .filter((group) => group.products.length > 0);
  const photo = modelImage(data.brand.slug, data.model.slug);
  const base = catalogHref(locale, `/${data.brand.slug}/${data.model.slug}`);
  const hrefFor = (next: { tip?: string | null; stoc?: boolean }) => {
    const query = new URLSearchParams();
    const nextTip = next.tip === undefined ? tip : next.tip;
    const nextStoc = next.stoc === undefined ? onlyInStock : next.stoc;
    if (nextTip) query.set("tip", nextTip);
    if (nextStoc) query.set("stoc", "1");
    const search = query.toString();
    return search ? `${base}?${search}` : base;
  };
  const chip = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-[#1b1a17] text-white"
        : "border border-black/10 bg-white text-[#57534a] hover:border-black/20 hover:text-[#1b1a17]"
    }`;

  return (
    <>
      <section className="relative overflow-hidden border-b border-black/10">
        <p
          aria-hidden
          className="pointer-events-none absolute -bottom-8 left-0 select-none whitespace-nowrap text-[20vw] font-bold leading-none tracking-tighter text-black/[0.04]"
        >
          {data.model.name}
        </p>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-32 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-44">
          <Reveal>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-[#6f6a61]">
              <Link href={catalogHref(locale)} className="transition-colors hover:text-[#1b1a17]">
                {copy.common.catalog}
              </Link>
              <span aria-hidden className="text-[#b4afa5]">/</span>
              <Link
                href={catalogHref(locale, `/${data.brand.slug}`)}
                className="transition-colors hover:text-[#1b1a17]"
              >
                {data.brand.name}
              </Link>
              <span aria-hidden className="text-[#b4afa5]">/</span>
              <span className="text-[#1b1a17]">{data.model.name}</span>
            </nav>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              {data.brand.name}{" "}
              <span className="text-[#2e90fa]">{data.model.name}</span>
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-2 text-base text-[#57534a]">
              <span>{data.model.years ?? copy.common.allYears}</span>
              <span aria-hidden className="text-[#b4afa5]">·</span>
              <span>{copy.common.parts(total)}</span>
              {inStockTotal > 0 ? (
                <>
                  <span aria-hidden className="text-[#b4afa5]">·</span>
                  <span className="font-medium text-emerald-700">
                    {copy.common.inStockCount(inStockTotal)}
                  </span>
                </>
              ) : null}
            </div>
          </Reveal>
          {photo ? (
            <Reveal delay={0.1}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-black/10 bg-white">
                <Image
                  src={photo}
                  alt={`${data.brand.name} ${data.model.name}`}
                  fill
                  priority
                  sizes="(min-width: 768px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      <div className="sticky top-[76px] z-30 border-b border-black/10 bg-[#f6f6f4]/85 backdrop-blur-xl sm:top-[80px]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
          <nav
            aria-label={copy.model.categories}
            className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-0.5 pr-6 [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <Link href={hrefFor({ tip: null })} className={chip(!tip)} scroll={false}>
              {copy.common.all}
              <span className="font-mono text-xs opacity-60">
                {numberFormat.format(onlyInStock ? inStockTotal : total)}
              </span>
            </Link>
            {data.groups.map((group) => (
              <Link
                key={group.slug}
                href={hrefFor({ tip: group.slug })}
                className={chip(tip === group.slug)}
                scroll={false}
              >
                {group.type}
                <span className="font-mono text-xs opacity-60">{countFor(group.products)}</span>
              </Link>
            ))}
          </nav>
          <Link
            href={hrefFor({ stoc: !onlyInStock })}
            scroll={false}
            role="switch"
            aria-checked={onlyInStock}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              onlyInStock
                ? "bg-emerald-600 text-white"
                : "border border-black/10 bg-white text-[#57534a] hover:text-[#1b1a17]"
            }`}
          >
            <span
              aria-hidden
              className={`relative h-4 w-7 rounded-full transition-colors ${
                onlyInStock ? "bg-white/30" : "bg-black/10"
              }`}
            >
              <span
                className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-[left] ${
                  onlyInStock ? "left-3.5" : "left-0.5"
                }`}
              />
            </span>
            <span className="hidden sm:inline">{copy.model.onlyInStock}</span>
            <span className="sm:hidden">{copy.common.inStock}</span>
          </Link>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pb-28 md:pt-14">
        {activeGroups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/15 bg-white/60 px-6 py-16 text-center">
            <p className="text-base text-[#57534a]">{copy.model.noneInStock}</p>
            <Link
              href={hrefFor({ stoc: false })}
              scroll={false}
              className="mt-6 inline-flex rounded-full bg-[#1b1a17] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              {copy.model.showAll}
            </Link>
          </div>
        ) : (
          <div className="space-y-14 md:space-y-20">
            {activeGroups.map((group) => (
              <div key={group.slug} id={group.slug} className="scroll-mt-40">
                <Reveal>
                  <div className="flex items-baseline justify-between gap-4 border-b border-black/10 pb-4">
                    <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{group.type}</h2>
                    <span className="font-mono text-sm text-[#6f6a61]">
                      {copy.common.parts(group.products.length)}
                    </span>
                  </div>
                </Reveal>
                <StaggerGroup className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {group.products.map((product) => (
                    <PartCard key={product.id} locale={locale} part={product} />
                  ))}
                </StaggerGroup>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
