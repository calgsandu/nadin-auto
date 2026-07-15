import Link from "next/link";
import Image from "next/image";
import { getShowroomData } from "@/lib/vitrina/queries";
import { brandLogo } from "@/lib/vitrina/images";
import {
  HeroIntro,
  Reveal,
  ScaleImage,
  ScrubWords,
  StaggerGroup,
} from "./motion";

export const revalidate = 3600;

const numberFormat = new Intl.NumberFormat("ro-RO");

const CATEGORY_CARDS = [
  { match: "Prag", title: "Praguri", image: "/vitrina/praguri.jpg" },
  { match: "Aripa", title: "Aripi", image: "/vitrina/aripa.jpg" },
  { match: "Stop", title: "Optică", image: "/vitrina/far.jpg" },
];

export default async function CatalogPage() {
  const { totals, brands, types } = await getShowroomData();
  const cardTypes = new Set(CATEGORY_CARDS.map((card) => card.match));
  const chipTypes = types.filter((type) => !cardTypes.has(type.name)).slice(0, 18);

  return (
    <>
      <section className="relative flex min-h-svh items-end overflow-hidden">
        <Image
          src="/vitrina/hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#0b0a08_78%)]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0b0a08] to-transparent" />
        <HeroIntro className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-40 text-center md:pb-32">
          <h1
            data-hero
            className="mx-auto max-w-6xl text-balance text-[clamp(2.75rem,6vw,5.5rem)] font-bold leading-[1.02] tracking-tight"
          >
            Piese de caroserie pentru mașina ta.
          </h1>
          <p data-hero className="mt-5 text-base text-[#b5afa4] md:text-lg">
            {numberFormat.format(totals.products)} repere · {totals.brands} mărci
            · {totals.models} modele
          </p>
          <div data-hero className="mt-9 flex flex-wrap justify-center gap-4">
            <Link
              href="#marci"
              className="rounded-full bg-[#d97706] px-7 py-3.5 text-sm font-semibold text-[#0b0a08] transition-colors hover:bg-[#f59e0b]"
            >
              Alege marca
            </Link>
            <Link
              href="/catalog/cauta"
              className="rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-[#f4f1ea] backdrop-blur transition-colors hover:bg-white/10"
            >
              Caută o piesă
            </Link>
          </div>
        </HeroIntro>
      </section>

      <section className="overflow-hidden border-y border-white/10 py-8" aria-hidden>
        <div className="flex w-max animate-[vitrina-marquee_70s_linear_infinite] gap-4">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-4">
              {brands.map((brand) => {
                const logo = brandLogo(brand.slug);
                return (
                  <span
                    key={`${copy}-${brand.slug}`}
                    className="grid h-16 w-28 shrink-0 place-items-center rounded-2xl bg-white/95 p-3.5"
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
            Ce ține mașina <span className="text-[#d97706]">întreagă</span>.
          </h2>
        </Reveal>
        <StaggerGroup className="mt-14 grid grid-flow-dense grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
          {CATEGORY_CARDS.map((card, index) => {
            const type = types.find((entry) => entry.name === card.match);
            const big = index === 0;
            return (
              <Link
                key={card.title}
                href={`/catalog/cauta?q=${encodeURIComponent(card.match)}`}
                data-stagger
                className={`group relative overflow-hidden rounded-3xl border border-white/10 ${
                  big ? "md:col-span-4 md:row-span-2 min-h-96" : "md:col-span-2 min-h-56"
                }`}
              >
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover opacity-80 transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a08]/95 via-[#0b0a08]/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                  <span className={`font-bold tracking-tight ${big ? "text-3xl md:text-4xl" : "text-xl"}`}>
                    {card.title}
                  </span>
                  {type ? (
                    <span className="font-mono text-sm text-[#d97706]">
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
              href={`/catalog/cauta?q=${encodeURIComponent(type.name)}`}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-[#b5afa4] transition-colors hover:border-[#d97706]/60 hover:text-[#f4f1ea]"
            >
              {type.name}
              <span className="ml-2 font-mono text-xs text-[#57524a]">
                {numberFormat.format(type.count)}
              </span>
            </Link>
          ))}
        </Reveal>
      </section>

      <section id="marci" className="mx-auto max-w-6xl px-6 py-24 md:py-40">
        <Reveal>
          <h2 className="max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Alege marca. Vezi tot ce avem.
          </h2>
        </Reveal>
        <StaggerGroup className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {brands.map((brand) => {
            const logo = brandLogo(brand.slug);
            return (
              <Link
                key={brand.slug}
                href={`/catalog/${brand.slug}`}
                data-stagger
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-[#d97706]/60 hover:bg-[#d97706]/5"
              >
                <div className="flex items-center gap-3">
                  {logo ? (
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/95 p-1.5">
                      <Image
                        src={logo}
                        alt={brand.name}
                        width={44}
                        height={44}
                        className="h-8 w-full object-contain"
                      />
                    </span>
                  ) : null}
                  <p className="truncate text-base font-semibold tracking-tight group-hover:text-[#d97706]">
                    {brand.name}
                  </p>
                </div>
                <p className="mt-3 font-mono text-xs text-[#8f887c]">
                  {brand.modelCount} modele · {numberFormat.format(brand.productCount)}{" "}
                  piese
                </p>
              </Link>
            );
          })}
        </StaggerGroup>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center md:py-40">
        <ScrubWords
          className="text-3xl font-semibold leading-snug tracking-tight md:text-5xl"
          text="Fiecare piesă din catalog e legată de model și anii de fabricație — alegi mașina și vezi exact ce avem pentru ea."
        />
      </section>

      <section className="relative">
        <ScaleImage className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-white/10 md:aspect-[21/9]">
            <Image
              src="/vitrina/depozit.jpg"
              alt="Depozitul Nadin Auto"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0a08]/80 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-6 p-8 md:grid-cols-4 md:p-12">
              {[
                [numberFormat.format(totals.products), "repere în catalog"],
                [String(totals.brands), "mărci auto"],
                [String(totals.models), "modele acoperite"],
                [String(totals.types), "categorii de piese"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-3xl font-bold tracking-tight text-[#d97706] md:text-5xl">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-[#b5afa4] md:text-sm">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </ScaleImage>
      </section>
    </>
  );
}
