import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { getPopularModels, getShowroomData } from "@/lib/vitrina/queries";
import { brandLogo, modelImage } from "@/lib/vitrina/images";
import { SearchBox } from "./cauta/search-box";
import {
  catalogCopy,
  catalogHref,
  catalogNumberFormat,
} from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";
import {
  HeroIntro,
  Reveal,
  ScaleImage,
  ScrubWords,
  StaggerGroup,
} from "./motion";

export const revalidate = 3600;

const CATEGORY_CARDS = [
  { match: "Prag" as const, image: "/vitrina/praguri.jpg" },
  { match: "Aripa" as const, image: "/vitrina/aripa.jpg" },
  { match: "Stop" as const, image: "/vitrina/far.jpg" },
] as const;

export default async function CatalogPage() {
  const locale = await getRequestCatalogLocale();
  const copy = catalogCopy(locale);
  const numberFormat = catalogNumberFormat(locale);
  const [{ totals, brands, types }, popularRows] = await Promise.all([
    getShowroomData(locale),
    getPopularModels(locale, 40),
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
  const cardTypes = new Set(CATEGORY_CARDS.map((card) => card.match));
  const chipTypes = types.filter((type) => !cardTypes.has(type.sourceName as (typeof CATEGORY_CARDS)[number]["match"])).slice(0, 18);

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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,19,27,0.30)_0%,rgba(14,19,27,0.42)_45%,rgba(14,19,27,0.62)_100%)]" />
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
            className="mx-auto mt-6 max-w-5xl text-balance text-[clamp(2.6rem,6vw,5.25rem)] font-bold leading-[1.02] tracking-tight text-white [text-shadow:0_2px_24px_rgb(0_0_0_/_0.35)]"
          >
            {copy.home.title}
          </h1>
          <div data-hero className="mx-auto mt-10 max-w-2xl text-left">
            <Suspense>
              <SearchBox locale={locale} autoFocus={false} />
            </Suspense>
          </div>
          <div
            data-hero
            className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-sm"
          >
            <span className="text-white/75">{copy.home.quickSearch}</span>
            {quickTypes.map((type) => (
              <Link
                key={type.slug}
                href={`${catalogHref(locale, "/cauta")}?q=${encodeURIComponent(type.name)}`}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white backdrop-blur transition-colors hover:bg-white/25"
              >
                {type.name}
              </Link>
            ))}
            <Link
              href="#marci"
              className="rounded-full bg-white px-3 py-1 font-semibold text-[#1b1a17] transition-colors hover:bg-white/90"
            >
              {copy.home.chooseBrand} ↓
            </Link>
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
        <section className="mx-auto max-w-6xl px-6 pb-8 pt-20 md:pt-28">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold leading-[1.08] tracking-tight md:text-5xl">
                  {copy.home.popularTitle}
                </h2>
                <p className="mt-4 text-base text-[#6f6a61] md:text-lg">{copy.home.popularLead}</p>
              </div>
              <Link
                href="#marci"
                className="rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
              >
                {copy.home.allBrands} →
              </Link>
            </div>
          </Reveal>
          <StaggerGroup className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {popular.map((model, index) => (
              <Link
                key={`${model.brandSlug}/${model.slug}`}
                href={catalogHref(locale, `/${model.brandSlug}/${model.slug}`)}
                data-stagger
                className="group flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[#2e90fa]/50 hover:shadow-[0_18px_40px_-24px_rgb(27_26_23_/_0.35)]"
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

      <section id="marci" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-16 md:py-24">
        <Reveal>
          <h2 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            {copy.home.brandsTitle}
          </h2>
        </Reveal>
        <StaggerGroup className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
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

      <section id="categorii" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-16 md:py-24">
        <Reveal>
          <h2 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            {copy.home.categoryTitle}{" "}<span className="text-[#2e90fa]">{copy.home.categoryAccent}</span>.
          </h2>
        </Reveal>
        <StaggerGroup className="mt-10 grid grid-flow-dense grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
          {CATEGORY_CARDS.map((card, index) => {
            const type = types.find((entry) => entry.sourceName === card.match);
            const big = index === 0;
            const title = copy.home.categories[card.match];
            return (
              <Link
                key={card.match}
                href={`${catalogHref(locale, "/cauta")}?q=${encodeURIComponent(locale === "ru" ? title : card.match)}`}
                data-stagger
                className={`group relative overflow-hidden rounded-3xl border border-black/10 ${
                  big ? "md:col-span-4 md:row-span-2 min-h-96" : "md:col-span-2 min-h-56"
                }`}
              >
                <Image
                  src={card.image}
                  alt={title}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover opacity-80 transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                  <span className={`font-bold tracking-tight text-white ${big ? "text-3xl md:text-4xl" : "text-xl"}`}>
                    {title}
                  </span>
                  {type ? (
                    <span className="font-mono text-sm text-[#2e90fa]">
                      {numberFormat.format(type.count)}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </StaggerGroup>
        <Reveal className="mt-8 flex flex-wrap gap-2.5" delay={0.1}>
          {chipTypes.map((type) => (
            <Link
              key={type.slug}
              href={`${catalogHref(locale, "/cauta")}?q=${encodeURIComponent(type.name)}`}
              className="rounded-full border border-black/10 px-4 py-2 text-sm text-[#57534a] transition-colors hover:border-[#2e90fa]/60 hover:text-[#1b1a17]"
            >
              {type.name}
              <span className="ml-2 font-mono text-xs text-[#98948b]">
                {numberFormat.format(type.count)}
              </span>
            </Link>
          ))}
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center md:py-28">
        <ScrubWords
          className="text-3xl font-semibold leading-snug tracking-tight md:text-5xl"
          text={copy.home.explainer}
        />
      </section>

      <section className="relative">
        <ScaleImage className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-black/10 md:aspect-[21/9]">
            <Image
              src="/vitrina/depozit.jpg"
              alt={copy.home.warehouseAlt}
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-6 p-8 md:grid-cols-4 md:p-12">
              {[
                [numberFormat.format(totals.products), copy.home.stats.products],
                [String(totals.brands), copy.home.stats.brands],
                [String(totals.models), copy.home.stats.models],
                [String(totals.types), copy.home.stats.categories],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-3xl font-bold tracking-tight text-[#6db5fc] md:text-5xl">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-white/75 md:text-sm">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </ScaleImage>
      </section>
    </>
  );
}
