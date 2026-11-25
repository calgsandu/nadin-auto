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

  // Un tip necunoscut în URL (link vechi) arată toate piesele, nu o pagină goală.
  const selected = data.groups.filter((group) => group.slug === tip);
  const activeGroups = selected.length > 0 ? selected : data.groups;
  const photo = modelImage(data.brand.slug, data.model.slug);
  const base = catalogHref(locale, `/${data.brand.slug}/${data.model.slug}`);
  const hrefFor = (nextTip: string | null) =>
    nextTip ? `${base}?tip=${encodeURIComponent(nextTip)}` : base;
  const activeTip = selected.length > 0 ? tip : undefined;
  // Filtrele sunt taburi de text cu linie sub cel activ, nu pastile.
  const tab = (active: boolean) =>
    `-mb-px shrink-0 whitespace-nowrap border-b-2 py-3.5 text-[15px] transition-colors ${
      active
        ? "border-(--c-accent) font-medium text-(--c-ink)"
        : "border-transparent text-(--c-muted) hover:text-(--c-ink)"
    }`;

  return (
    <>
      <section className="border-b border-(--c-line)">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 pb-12 pt-28 md:grid-cols-[1.1fr_1fr] md:pb-16 md:pt-32">
          <Reveal>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-(--c-muted)">
              <Link href={catalogHref(locale)} className="transition-colors hover:text-(--c-ink)">
                {copy.common.catalog}
              </Link>
              <span aria-hidden className="text-(--c-faint)">/</span>
              <Link
                href={catalogHref(locale, `/${data.brand.slug}`)}
                className="transition-colors hover:text-(--c-ink)"
              >
                {data.brand.name}
              </Link>
            </nav>
            <h1 className="mt-3 text-[2rem] font-medium leading-tight tracking-tight md:text-5xl">
              {data.brand.name} {data.model.name}
            </h1>
            <p className="mt-2 text-base text-(--c-muted)">
              {data.model.years ?? copy.common.allYears}
            </p>
          </Reveal>
          {photo ? (
            <Reveal delay={0.1}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem] border border-(--c-line) bg-(--c-surface)">
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

      <div className="sticky top-16 z-30 border-b border-(--c-line) bg-(--c-bg)/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6">
          <nav
            aria-label={copy.model.categories}
            className="flex min-w-0 flex-1 gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <Link href={hrefFor(null)} className={tab(!activeTip)} scroll={false}>
              {copy.common.all}
            </Link>
            {data.groups.map((group) => (
              <Link
                key={group.slug}
                href={hrefFor(group.slug)}
                className={tab(activeTip === group.slug)}
                scroll={false}
              >
                {group.type}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pb-24 md:pt-12">
        <div className="space-y-12 md:space-y-16">
          {activeGroups.map((group) => (
            <div key={group.slug} id={group.slug} className="scroll-mt-36">
              <Reveal>
                <h2 className="text-[1.375rem] font-medium tracking-tight md:text-2xl">{group.type}</h2>
              </Reveal>
              <StaggerGroup className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {group.products.map((product) => (
                  <PartCard key={product.id} locale={locale} part={product} />
                ))}
              </StaggerGroup>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
