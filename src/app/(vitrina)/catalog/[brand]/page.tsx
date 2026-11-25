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

  const logo = brandLogo(brand.slug);

  return (
    <>
      <section className="border-b border-(--c-line)">
        <div className="mx-auto max-w-6xl px-6 pb-10 pt-28 md:pb-14 md:pt-32">
          <Reveal>
            <nav aria-label="Breadcrumb" className="text-sm text-(--c-muted)">
              <Link href={catalogHref(locale)} className="transition-colors hover:text-(--c-ink)">
                {copy.common.catalog}
              </Link>
            </nav>
            <div className="mt-3 flex items-center gap-4">
              {logo ? (
                <span className="grid size-16 shrink-0 place-items-center rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) p-2.5 md:size-20">
                  <Image
                    src={logo}
                    alt=""
                    width={80}
                    height={80}
                    className="h-11 w-full object-contain md:h-14"
                  />
                </span>
              ) : null}
              <h1 className="text-[2rem] font-medium leading-tight tracking-tight md:text-5xl">
                {brand.name}
              </h1>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pb-24 md:pt-12">
        <StaggerGroup className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {brand.models.map((model) => {
            const photo = modelImage(brand.slug, model.slug);
            return (
              <Link
                key={model.slug}
                href={catalogHref(locale, `/${brand.slug}/${model.slug}`)}
                data-stagger
                className="group flex flex-col overflow-hidden rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) transition-colors hover:border-(--c-accent)/50"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-(--c-surface-2)">
                  {photo ? (
                    <Image
                      src={photo}
                      alt={`${brand.name} ${model.name}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      {logo ? (
                        <Image
                          src={logo}
                          alt=""
                          width={96}
                          height={64}
                          className="h-12 w-auto object-contain opacity-20 grayscale"
                        />
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate text-[17px] font-medium tracking-tight group-hover:text-(--c-accent)">
                    {model.name}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-(--c-muted-2)">
                    {model.years ?? copy.common.allYears}
                  </p>
                </div>
              </Link>
            );
          })}
        </StaggerGroup>
      </section>
    </>
  );
}
