import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getBrandData, getShowroomData } from "@/lib/vitrina/queries";
import { brandLogo, modelImage } from "@/lib/vitrina/images";
import { Reveal, StaggerGroup } from "../motion";
import type { Metadata } from "next";
import {
  catalogCopy,
  catalogHref,
  catalogNumberFormat,
} from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";

export const revalidate = 3600;

export async function generateStaticParams() {
  const { brands } = await getShowroomData("ro");
  return brands.map((brand) => ({ brand: brand.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>;
}): Promise<Metadata> {
  const [{ brand: brandSlug }, locale] = await Promise.all([
    params,
    getRequestCatalogLocale(),
  ]);
  const brand = await getBrandData(brandSlug, locale);
  if (!brand) return {};
  const suffix = `/${brandSlug}`;
  return {
    title: locale === "ru" ? `${brand.name}: кузовные детали — Nadin Auto` : `${brand.name}: piese de caroserie — Nadin Auto`,
    alternates: {
      canonical: catalogHref(locale, suffix),
      languages: { ro: catalogHref("ro", suffix), ru: catalogHref("ru", suffix) },
    },
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const [{ brand: brandSlug }, locale] = await Promise.all([
    params,
    getRequestCatalogLocale(),
  ]);
  const copy = catalogCopy(locale);
  const numberFormat = catalogNumberFormat(locale);
  const brand = await getBrandData(brandSlug, locale);
  if (!brand || brand.models.length === 0) notFound();

  const total = brand.models.reduce((sum, model) => sum + model.productCount, 0);
  const logo = brandLogo(brand.slug);

  return (
    <>
      <section className="relative overflow-hidden border-b border-black/10">
        <p
          aria-hidden
          className="pointer-events-none absolute -bottom-8 left-0 select-none whitespace-nowrap text-[22vw] font-bold leading-none tracking-tighter text-black/[0.04]"
        >
          {brand.name}
        </p>
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-36 md:pb-24 md:pt-44">
          <Reveal>
            <p className="text-sm text-[#6f6a61]">
              <Link href={catalogHref(locale)} className="transition-colors hover:text-[#1b1a17]">
                {copy.common.catalog}
              </Link>{" "}
              / {brand.name}
            </p>
            <div className="mt-4 flex items-center gap-5">
              {logo ? (
                <span className="grid size-20 shrink-0 place-items-center rounded-2xl border border-black/10 bg-white p-3 md:size-24">
                  <Image
                    src={logo}
                    alt={brand.name}
                    width={96}
                    height={96}
                    className="h-14 w-full object-contain md:h-18"
                  />
                </span>
              ) : null}
              <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
                {brand.name}
              </h1>
            </div>
            <p className="mt-4 text-base text-[#57534a] md:text-lg">
              {copy.common.models(brand.models.length)} · {copy.common.parts(total)}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brand.models.map((model) => {
            const photo = modelImage(brand.slug, model.slug);
            return (
              <Link
                key={model.slug}
                href={catalogHref(locale, `/${brand.slug}/${model.slug}`)}
                data-stagger
                className="group overflow-hidden rounded-2xl border border-black/10 bg-white transition-colors hover:border-[#2e90fa]/60"
              >
                {photo ? (
                  <div className="relative aspect-[4/3] overflow-hidden bg-white">
                    <Image
                      src={photo}
                      alt={`${brand.name} ${model.name}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 p-6">
                  <div className="min-w-0">
                    <p className="truncate text-xl font-semibold tracking-tight group-hover:text-[#2e90fa]">
                      {model.name}
                    </p>
                    <p className="mt-2 font-mono text-xs text-[#6f6a61]">
                      {model.years ?? copy.common.allYears}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 font-mono text-xs text-[#57534a]">
                    {numberFormat.format(model.productCount)}
                  </span>
                </div>
              </Link>
            );
          })}
        </StaggerGroup>
      </section>
    </>
  );
}
