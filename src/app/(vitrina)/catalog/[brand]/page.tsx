import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getBrandData, getShowroomData } from "@/lib/vitrina/queries";
import { brandLogo, modelImage } from "@/lib/vitrina/images";
import { Reveal, StaggerGroup } from "../motion";
import type { Metadata } from "next";
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";
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
        <div className="relative mx-auto max-w-6xl px-6 pb-14 pt-32 md:pb-24 md:pt-44">
          <Reveal>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-[#6f6a61]">
              <Link href={catalogHref(locale)} className="transition-colors hover:text-[#1b1a17]">
                {copy.common.catalog}
              </Link>
              <span aria-hidden className="text-[#b4afa5]">/</span>
              <span className="text-[#1b1a17]">{brand.name}</span>
            </nav>
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
              {copy.common.models(brand.models.length)}, {copy.common.parts(total)}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pb-24 md:pt-16">
        <StaggerGroup className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {brand.models.map((model) => {
            const photo = modelImage(brand.slug, model.slug);
            return (
              <Link
                key={model.slug}
                href={catalogHref(locale, `/${brand.slug}/${model.slug}`)}
                data-stagger
                className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-colors hover:border-[#2e90fa]/60"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f1f0ec]">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={`${brand.name} ${model.name}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, 50vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_40%,#ffffff,#ebeae5_75%)] p-4">
                      {logo ? (
                        <Image
                          src={logo}
                          alt=""
                          width={96}
                          height={64}
                          className="h-10 w-auto object-contain opacity-25 grayscale md:h-14"
                        />
                      ) : null}
                      <span className="max-w-full truncate text-2xl font-bold tracking-tight text-black/15 md:text-4xl">
                        {model.name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 items-center justify-between gap-3 p-4 md:p-5">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold tracking-tight group-hover:text-[#2e90fa] md:text-xl">
                      {model.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-[#6f6a61] md:text-sm">
                      {model.years ?? copy.common.allYears} · {copy.common.parts(model.productCount)}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="hidden shrink-0 text-lg text-[#b4afa5] transition-colors group-hover:text-[#2e90fa] sm:inline"
                  >
                    →
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
