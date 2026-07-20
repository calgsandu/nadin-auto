import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getModelData } from "@/lib/vitrina/queries";
import { productImage, modelImage } from "@/lib/vitrina/images";
import { LocalBadge } from "@/app/components/local-badge";
import { Reveal, StaggerGroup } from "../../motion";
import type { Metadata } from "next";
import {
  catalogCopy,
  catalogHref,
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
  searchParams: Promise<{ tip?: string }>;
}) {
  const [{ brand: brandSlug, model: modelSlug }, { tip }, locale] = await Promise.all([
    params,
    searchParams,
    getRequestCatalogLocale(),
  ]);
  const copy = catalogCopy(locale);
  const data = await getModelData(brandSlug, modelSlug, locale);
  if (!data) notFound();

  const total = data.groups.reduce((sum, group) => sum + group.products.length, 0);
  const activeGroups = tip
    ? data.groups.filter((group) => group.slug === tip)
    : data.groups;
  const photo = modelImage(data.brand.slug, data.model.slug);

  return (
    <>
      <section className="relative overflow-hidden border-b border-black/10">
        <p
          aria-hidden
          className="pointer-events-none absolute -bottom-8 left-0 select-none whitespace-nowrap text-[20vw] font-bold leading-none tracking-tighter text-black/[0.04]"
        >
          {data.model.name}
        </p>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-36 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-44">
          <Reveal>
            <p className="text-sm text-[#6f6a61]">
              <Link href={catalogHref(locale)} className="transition-colors hover:text-[#1b1a17]">
                {copy.common.catalog}
              </Link>{" "}
              /{" "}
              <Link
                href={catalogHref(locale, `/${data.brand.slug}`)}
                className="transition-colors hover:text-[#1b1a17]"
              >
                {data.brand.name}
              </Link>{" "}
              / {data.model.name}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              {data.brand.name}{" "}
              <span className="text-[#2e90fa]">{data.model.name}</span>
            </h1>
            <p className="mt-4 text-base text-[#57534a]">
              {data.model.years ?? copy.common.allYears} · {copy.common.parts(total)}
            </p>
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

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="flex flex-wrap gap-2">
          <Link
            href={catalogHref(locale, `/${data.brand.slug}/${data.model.slug}`)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !tip
                ? "bg-[#1b1a17] text-white"
                : "border border-black/10 text-[#57534a] hover:text-[#1b1a17]"
            }`}
          >
            {copy.common.all}
          </Link>
          {data.groups.map((group) => (
            <Link
              key={group.slug}
              href={`${catalogHref(locale, `/${data.brand.slug}/${data.model.slug}`)}?tip=${group.slug}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tip === group.slug
                  ? "bg-[#1b1a17] text-white"
                  : "border border-black/10 text-[#57534a] hover:text-[#1b1a17]"
              }`}
            >
              {group.type}
              <span className="ml-2 font-mono text-xs opacity-60">
                {group.products.length}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-12 space-y-16">
          {activeGroups.map((group) => (
            <div key={group.slug}>
              <Reveal>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {group.type}
                  <span className="ml-3 font-mono text-sm font-normal text-[#6f6a61]">
                    {group.products.length}
                  </span>
                </h2>
              </Reveal>
              <StaggerGroup className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.products.map((product) => {
                  const image = productImage(product.code);
                  return (
                    <Link
                      key={product.id}
                      href={catalogHref(locale, `/piesa/${product.id}`)}
                      data-stagger
                      className="group rounded-2xl border border-black/10 bg-white p-5 transition-colors hover:border-[#2e90fa]/60"
                    >
                      {image ? (
                        <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-xl border border-black/10">
                          <Image
                            src={image}
                            alt={product.description}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          />
                        </div>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-mono text-xs text-[#2e90fa]">
                          {product.code ?? "—"}
                        </p>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {product.isLocal ? <LocalBadge locale={locale} /> : null}
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              product.inStock
                                ? "bg-emerald-600/10 text-emerald-700"
                                : "bg-black/5 text-[#6f6a61]"
                            }`}
                          >
                            {product.inStock ? copy.common.inStock : copy.common.outOfStock}
                          </span>
                        </span>
                      </div>
                      <p className="mt-3 text-base font-medium leading-snug group-hover:text-[#2e90fa]">
                        {product.description}
                      </p>
                      <p className="mt-2 font-mono text-xs text-[#6f6a61]">
                        {product.fitLabel}
                      </p>
                    </Link>
                  );
                })}
              </StaggerGroup>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
