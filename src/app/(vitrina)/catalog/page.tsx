import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  getPopularModels,
  getShowroomData,
  getTypeSampleCodes,
  getVehicleIndex,
} from "@/lib/vitrina/queries";
import { brandLogo, modelImage, productImage } from "@/lib/vitrina/images";
import { VehicleFinder } from "./vehicle-finder";
import { PartPlaceholder } from "./part-card";
import {
  catalogCopy,
  catalogHref,
  catalogNumberFormat,
} from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";
import { HeroIntro, Reveal, StaggerGroup } from "./motion";

export const revalidate = 3600;

/** Câte categorii primesc card cu poză; restul rămân ca etichete dedesubt. */
const CATEGORY_TILES = 8;

/** Titlul unei secțiuni: simplu, de mărime potrivită, cu o frază de context. */
function SectionHeading({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <Reveal>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight md:text-[2.25rem] md:leading-tight">
            {title}
          </h2>
          {lead ? <p className="mt-2 text-[15px] text-[#6f6a61] md:text-base">{lead}</p> : null}
        </div>
        {action}
      </div>
    </Reveal>
  );
}

export default async function CatalogPage() {
  const locale = await getRequestCatalogLocale();
  const copy = catalogCopy(locale);
  const numberFormat = catalogNumberFormat(locale);
  const [{ totals, brands, types }, popularRows, vehicleIndex, sampleCodes] = await Promise.all([
    getShowroomData(locale),
    getPopularModels(locale, 40),
    getVehicleIndex(),
    getTypeSampleCodes(),
  ]);
  // Doar modelele cu poză (e o vitrină, un card gol ar strica rândul) și cel
  // mult două pe marcă, altfel primele opt ar fi aproape numai Mercedes.
  const perBrand = new Map<string, number>();
  const popular = popularRows
    .map((model) => ({ ...model, photo: modelImage(model.brandSlug, model.slug) }))
    .filter((model): model is typeof model & { photo: string } => {
      if (model.photo == null) return false;
      const used = perBrand.get(model.brandSlug) ?? 0;
      if (used >= 2) return false;
      perBrand.set(model.brandSlug, used + 1);
      return true;
    })
    .slice(0, 8);
  const quickTypes = types.slice(0, 5);
  // Fiecare categorie principală primește poza reală a uneia dintre piesele ei.
  const tileTypes = types.slice(0, CATEGORY_TILES).map((type) => {
    const codes = sampleCodes.get(type.sourceName) ?? [];
    let photo: string | null = null;
    for (const code of codes) {
      photo = productImage(code);
      if (photo) break;
    }
    return { ...type, photo };
  });
  const chipTypes = types.slice(CATEGORY_TILES, CATEGORY_TILES + 18);
  const searchHref = (query: string) =>
    `${catalogHref(locale, "/cauta")}?q=${encodeURIComponent(query)}`;

  return (
    <>
      <section className="relative flex min-h-[92svh] items-end overflow-hidden">
        <Image
          src="/vitrina/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Un voal uniform, fără gradient spre negru: doar cât textul alb să se citească. */}
        <div className="absolute inset-0 bg-[#16202c]/45" />
        <HeroIntro className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-36 text-center md:pb-28">
          <p
            data-hero
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm text-white/90 backdrop-blur"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-[#6db5fc]" />
            {copy.common.parts(totals.products)} · {copy.common.brands(totals.brands)} ·{" "}
            {copy.common.models(totals.models)}
          </p>
          <h1
            data-hero
            className="mx-auto mt-6 max-w-4xl text-balance text-[clamp(2.25rem,5vw,4.25rem)] font-bold leading-[1.05] tracking-tight text-white"
          >
            {copy.home.title}
          </h1>
          <div data-hero className="mx-auto mt-10 max-w-3xl">
            <VehicleFinder locale={locale} brands={vehicleIndex} />
          </div>
          <div
            data-hero
            className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-sm"
          >
            <span className="text-white/75">{copy.home.quickSearch}</span>
            {quickTypes.map((type) => (
              <Link
                key={type.slug}
                href={searchHref(type.name)}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white backdrop-blur transition-colors hover:bg-white/25"
              >
                {type.name}
              </Link>
            ))}
          </div>
        </HeroIntro>
      </section>

      <section className="overflow-hidden border-y border-black/10 py-8" aria-hidden>
        <div className="flex w-max animate-[vitrina-marquee_70s_linear_infinite] gap-4">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-4">
              {brands.map((brand) => {
                const logo = brandLogo(brand.slug);
                return (
                  <span
                    key={`${copy}-${brand.slug}`}
                    className="grid h-16 w-28 shrink-0 place-items-center rounded-2xl border border-black/10 bg-white p-3.5"
                    title={brand.name}
                  >
                    {logo ? (
                      <Image
                        src={logo}
                        alt={brand.name}
                        width={112}
                        height={64}
                        className="h-9 w-full object-contain"
                      />
                    ) : (
                      <span className="text-base font-semibold text-[#1b1a17]">
                        {brand.name}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {popular.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-4 pt-16 md:pt-24">
          <SectionHeading
            title={copy.home.popularTitle}
            lead={copy.home.popularLead}
            action={
              <Link
                href="#marci"
                className="rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
              >
                {copy.home.allBrands} →
              </Link>
            }
          />
          <StaggerGroup className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {popular.map((model, index) => (
              <Link
                key={`${model.brandSlug}/${model.slug}`}
                href={catalogHref(locale, `/${model.brandSlug}/${model.slug}`)}
                data-stagger
                className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-colors hover:border-[#2e90fa]/60"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f1f0ec]">
                  <Image
                    src={model.photo}
                    alt={`${model.brand} ${model.name}`}
                    fill
                    priority={index < 4}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 items-end justify-between gap-3 p-3.5 sm:p-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-[#6f6a61]">{model.brand}</p>
                    <p className="mt-0.5 truncate text-base font-semibold tracking-tight group-hover:text-[#2e90fa] md:text-lg">
                      {model.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#98948b]">
                      {model.years ?? copy.common.allYears}
                    </p>
                  </div>
                  <span className="hidden shrink-0 rounded-full bg-[#2e90fa]/10 px-2.5 py-1 font-mono text-xs font-semibold text-[#1570d6] sm:inline">
                    {numberFormat.format(model.productCount)}
                  </span>
                </div>
              </Link>
            ))}
          </StaggerGroup>
        </section>
      ) : null}

      <section id="marci" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-14 md:py-20">
        <SectionHeading title={copy.home.brandsTitle} lead={copy.home.brandsLead} />
        <StaggerGroup className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {brands.map((brand) => {
            const logo = brandLogo(brand.slug);
            return (
              <Link
                key={brand.slug}
                href={catalogHref(locale, `/${brand.slug}`)}
                data-stagger
                className="group rounded-2xl border border-black/10 bg-white p-4 transition-colors hover:border-[#2e90fa]/60 hover:bg-[#2e90fa]/5 sm:p-5"
              >
                <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                  {logo ? (
                    <span className="grid size-9 shrink-0 place-items-center sm:size-11">
                      <Image
                        src={logo}
                        alt={brand.name}
                        width={44}
                        height={44}
                        className="h-8 w-full object-contain"
                      />
                    </span>
                  ) : null}
                  <p className="min-w-0 text-sm font-semibold leading-tight tracking-tight group-hover:text-[#2e90fa] sm:text-base">
                    {brand.name}
                  </p>
                </div>
                <p className="mt-3 text-sm text-[#6f6a61]">
                  {copy.common.models(brand.modelCount)}, {copy.common.parts(brand.productCount)}
                </p>
              </Link>
            );
          })}
        </StaggerGroup>
      </section>

      <section id="categorii" className="mx-auto max-w-6xl scroll-mt-28 px-6 pb-14 pt-4 md:pb-20 md:pt-6">
        <SectionHeading title={copy.home.categoriesTitle} lead={copy.home.categoriesLead} />
        <StaggerGroup className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {tileTypes.map((type) => (
            <Link
              key={type.slug}
              href={searchHref(type.name)}
              data-stagger
              className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-colors hover:border-[#2e90fa]/60"
            >
              <div
                className={`relative aspect-[4/3] overflow-hidden border-b border-black/5 ${
                  type.photo ? "bg-white" : "bg-[#f1f0ec]"
                }`}
              >
                {type.photo ? (
                  <Image
                    src={type.photo}
                    alt={type.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                ) : (
                  <PartPlaceholder locale={locale} />
                )}
              </div>
              <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4">
                <p className="truncate text-base font-semibold tracking-tight group-hover:text-[#2e90fa]">
                  {type.name}
                </p>
                <span className="shrink-0 font-mono text-xs text-[#6f6a61]">
                  {numberFormat.format(type.count)}
                </span>
              </div>
            </Link>
          ))}
        </StaggerGroup>
        <Reveal className="mt-6 flex flex-wrap gap-2.5" delay={0.1}>
          {chipTypes.map((type) => (
            <Link
              key={type.slug}
              href={searchHref(type.name)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[#57534a] transition-colors hover:border-[#2e90fa]/60 hover:text-[#1b1a17]"
            >
              {type.name}
              <span className="ml-2 font-mono text-xs text-[#98948b]">
                {numberFormat.format(type.count)}
              </span>
            </Link>
          ))}
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-24">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Reveal className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-black/10 bg-[#f1f0ec] lg:aspect-auto">
            <Image
              src="/vitrina/depozit.jpg"
              alt={copy.home.warehouseAlt}
              fill
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col justify-between gap-6 rounded-2xl border border-black/10 bg-white p-6 md:p-8">
            <p className="text-lg font-semibold leading-snug tracking-tight md:text-xl">
              {copy.home.explainer}
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              {[
                [numberFormat.format(totals.products), copy.home.stats.products],
                [String(totals.brands), copy.home.stats.brands],
                [String(totals.models), copy.home.stats.models],
                [String(totals.types), copy.home.stats.categories],
              ].map(([value, label]) => (
                <div key={label} className="flex flex-col-reverse border-t border-black/10 pt-3">
                  <dt className="mt-0.5 text-sm text-[#6f6a61]">{label}</dt>
                  <dd className="text-2xl font-bold tracking-tight text-[#1570d6] md:text-3xl">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>
    </>
  );
}
