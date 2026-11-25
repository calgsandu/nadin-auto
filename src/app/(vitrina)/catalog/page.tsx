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
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";
import { HeroIntro, Reveal, ScaleImage, ScrubWords, StaggerGroup } from "./motion";

export const revalidate = 3600;

/** Câte categorii primesc card cu poză; restul rămân ca listă simplă dedesubt. */
const CATEGORY_TILES = 8;

/** Titlul unei secțiuni, ca antetele din CRM: greutate medie, o frază de context. */
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
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-2xl">
          <h2 className="text-[1.625rem] font-medium leading-tight tracking-tight lg:text-[2rem]">
            {title}
          </h2>
          {lead ? <p className="mt-1.5 text-[15px] text-(--c-muted)">{lead}</p> : null}
        </div>
        {action}
      </div>
    </Reveal>
  );
}

export default async function CatalogPage() {
  const locale = await getRequestCatalogLocale();
  const copy = catalogCopy(locale);
  const [{ brands, types }, popularRows, vehicleIndex, sampleCodes] = await Promise.all([
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
  const listTypes = types.slice(CATEGORY_TILES, CATEGORY_TILES + 18);
  const searchHref = (query: string) =>
    `${catalogHref(locale, "/cauta")}?q=${encodeURIComponent(query)}`;

  return (
    <>
      <section className="relative flex min-h-[88svh] items-end overflow-hidden">
        <Image
          src="/vitrina/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Un voal uniform, doar cât textul alb să se citească pe poza deschisă. */}
        <div className="absolute inset-0 bg-[#16202c]/45" />
        <HeroIntro className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-32 text-center md:pb-28">
          <h1
            data-hero
            className="mx-auto max-w-4xl text-balance text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.08] tracking-tight text-white"
          >
            {copy.home.title}
          </h1>
          <div data-hero className="mx-auto mt-10 max-w-3xl">
            <VehicleFinder locale={locale} brands={vehicleIndex} />
          </div>
          <div
            data-hero
            className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm"
          >
            <span className="text-white/70">{copy.home.quickSearch}</span>
            {quickTypes.map((type) => (
              <Link
                key={type.slug}
                href={searchHref(type.name)}
                className="text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
              >
                {type.name}
              </Link>
            ))}
          </div>
        </HeroIntro>
      </section>

      <section className="overflow-hidden border-b border-(--c-line) py-8" aria-hidden>
        <div className="flex w-max animate-[vitrina-marquee_70s_linear_infinite] gap-4">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-4">
              {brands.map((brand) => {
                const logo = brandLogo(brand.slug);
                return (
                  <span
                    key={`${copy}-${brand.slug}`}
                    className="grid h-16 w-28 shrink-0 place-items-center rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) p-3.5"
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
                      <span className="text-base font-medium">{brand.name}</span>
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {popular.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pt-16 md:pt-24">
          <SectionHeading
            title={copy.home.popularTitle}
            lead={copy.home.popularLead}
            action={
              <Link
                href="#marci"
                className="text-sm font-medium text-(--c-accent) transition-colors hover:text-(--c-accent-hover)"
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
                className="group flex flex-col overflow-hidden rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) transition-colors hover:border-(--c-accent)/50"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-(--c-surface-2)">
                  <Image
                    src={model.photo}
                    alt={`${model.brand} ${model.name}`}
                    fill
                    priority={index < 4}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <p className="truncate text-[13px] text-(--c-muted)">{model.brand}</p>
                  <p className="truncate text-[17px] font-medium tracking-tight group-hover:text-(--c-accent)">
                    {model.name}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-(--c-muted-2)">
                    {model.years ?? copy.common.allYears}
                  </p>
                </div>
              </Link>
            ))}
          </StaggerGroup>
        </section>
      ) : null}

      <section id="marci" className="mx-auto max-w-6xl scroll-mt-24 px-6 pt-16 md:pt-24">
        <SectionHeading title={copy.home.brandsTitle} lead={copy.home.brandsLead} />
        <StaggerGroup className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {brands.map((brand) => {
            const logo = brandLogo(brand.slug);
            return (
              <Link
                key={brand.slug}
                href={catalogHref(locale, `/${brand.slug}`)}
                data-stagger
                className="group flex items-center gap-3 rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) px-4 py-4 transition-colors hover:border-(--c-accent)/50"
              >
                {logo ? (
                  <span className="grid size-10 shrink-0 place-items-center">
                    <Image
                      src={logo}
                      alt=""
                      width={40}
                      height={40}
                      className="h-8 w-full object-contain"
                    />
                  </span>
                ) : null}
                <span className="min-w-0 text-[15px] font-medium leading-tight group-hover:text-(--c-accent)">
                  {brand.name}
                </span>
              </Link>
            );
          })}
        </StaggerGroup>
      </section>

      <section id="categorii" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 md:py-24">
        <SectionHeading title={copy.home.categoriesTitle} lead={copy.home.categoriesLead} />
        <StaggerGroup className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {tileTypes.map((type) => (
            <Link
              key={type.slug}
              href={searchHref(type.name)}
              data-stagger
              className="group flex flex-col overflow-hidden rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) transition-colors hover:border-(--c-accent)/50"
            >
              <div className="relative aspect-[4/3] overflow-hidden border-b border-(--c-line-2) bg-white">
                {type.photo ? (
                  <Image
                    src={type.photo}
                    alt={type.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-contain p-4"
                  />
                ) : (
                  <PartPlaceholder locale={locale} />
                )}
              </div>
              <p className="truncate p-4 text-[15px] font-medium group-hover:text-(--c-accent)">
                {type.name}
              </p>
            </Link>
          ))}
        </StaggerGroup>
        {listTypes.length > 0 ? (
          <Reveal
            className="mt-8 grid grid-cols-2 gap-x-8 border-t border-(--c-line) sm:grid-cols-3 lg:grid-cols-4"
            delay={0.1}
          >
            {listTypes.map((type) => (
              <Link
                key={type.slug}
                href={searchHref(type.name)}
                className="truncate border-b border-(--c-line) py-3 text-[15px] transition-colors hover:text-(--c-accent)"
              >
                {type.name}
              </Link>
            ))}
          </Reveal>
        ) : null}
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16 text-center md:pb-24">
        <ScrubWords
          className="text-2xl font-medium leading-snug tracking-tight md:text-4xl"
          text={copy.home.explainer}
        />
      </section>

      <section className="relative pb-16 md:pb-24">
        <ScaleImage className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="relative aspect-video overflow-hidden rounded-[1.25rem] border border-(--c-line) md:aspect-[21/9]">
            <Image
              src="/vitrina/depozit.jpg"
              alt={copy.home.warehouseAlt}
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </ScaleImage>
      </section>
    </>
  );
}
