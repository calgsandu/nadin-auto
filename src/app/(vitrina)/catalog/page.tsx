import Link from "next/link";
import Image from "next/image";
import { getShowroomData } from "@/lib/vitrina/queries";
import { brandLogo } from "@/lib/vitrina/images";
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
  const { totals, brands, types } = await getShowroomData(locale);
  const cardTypes = new Set(CATEGORY_CARDS.map((card) => card.match));
  const chipTypes = types.filter((type) => !cardTypes.has(type.sourceName as (typeof CATEGORY_CARDS)[number]["match"])).slice(0, 18);

  return (
    <>
      <section className="relative flex min-h-svh items-end overflow-hidden">
        <Image
          src="/vitrina/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(20,25,32,0.34),rgba(20,25,32,0.12)_58%,rgba(20,25,32,0.2))]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#f6f6f4]/85 via-[#f6f6f4]/35 to-transparent" />
        <HeroIntro className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-40 text-center md:pb-32">
          <h1
            data-hero
            className="mx-auto max-w-6xl text-balance text-[clamp(2.75rem,6vw,5.5rem)] font-bold leading-[1.02] tracking-tight text-white [text-shadow:0_2px_22px_rgb(0_0_0_/_0.42)]"
          >
            {copy.home.title}
          </h1>
          <p data-hero className="mt-5 text-base text-white/90 [text-shadow:0_1px_12px_rgb(0_0_0_/_0.36)] md:text-lg">
            {numberFormat.format(totals.products)} · {copy.common.brands(totals.brands)}
            · {copy.common.models(totals.models)}
          </p>
          <div data-hero className="mt-9 flex flex-wrap justify-center gap-4">
            <Link
              href="#marci"
              className="rounded-full bg-[#2e90fa] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#1b7fe8]"
            >
              {copy.home.chooseBrand}
            </Link>
            <Link
              href={catalogHref(locale, "/cauta")}
              className="rounded-full border border-white/35 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              {copy.nav.search}
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
                      <span className="text-sm font-semibold uppercase tracking-wider text-[#1b1a17]">
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

      <section id="categorii" className="mx-auto max-w-6xl px-6 py-24 md:py-40">
        <Reveal>
          <h2 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            {copy.home.categoryTitle}{" "}<span className="text-[#2e90fa]">{copy.home.categoryAccent}</span>.
          </h2>
        </Reveal>
        <StaggerGroup className="mt-14 grid grid-flow-dense grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
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

      <section id="marci" className="mx-auto max-w-6xl px-6 py-24 md:py-40">
        <Reveal>
          <h2 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            {copy.home.brandsTitle}
          </h2>
        </Reveal>
        <StaggerGroup className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {brands.map((brand) => {
            const logo = brandLogo(brand.slug);
            return (
              <Link
                key={brand.slug}
                href={catalogHref(locale, `/${brand.slug}`)}
                data-stagger
                className="group rounded-2xl border border-black/10 bg-white p-5 transition-colors hover:border-[#2e90fa]/60 hover:bg-[#2e90fa]/5"
              >
                <div className="flex items-center gap-3">
                  {logo ? (
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-black/10 bg-white p-1.5">
                      <Image
                        src={logo}
                        alt={brand.name}
                        width={44}
                        height={44}
                        className="h-8 w-full object-contain"
                      />
                    </span>
                  ) : null}
                  <p className="truncate text-base font-semibold tracking-tight group-hover:text-[#2e90fa]">
                    {brand.name}
                  </p>
                </div>
                <p className="mt-3 font-mono text-xs text-[#6f6a61]">
                  {copy.common.models(brand.modelCount)} · {copy.common.parts(brand.productCount)}
                </p>
              </Link>
            );
          })}
        </StaggerGroup>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center md:py-40">
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
