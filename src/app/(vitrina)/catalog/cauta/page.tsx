import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { getShowroomData, searchPublicProducts } from "@/lib/vitrina/queries";
import { brandLogo } from "@/lib/vitrina/images";
import { SearchBox } from "./search-box";
import { PartCard } from "../part-card";
import type { Metadata } from "next";
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestCatalogLocale();
  const copy = catalogCopy(locale).metadata;
  const suffix = "/cauta";
  return {
    title: copy.searchTitle,
    description: copy.searchDescription,
    alternates: {
      canonical: catalogHref(locale, suffix),
      languages: { ro: catalogHref("ro", suffix), ru: catalogHref("ru", suffix) },
    },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, locale] = await Promise.all([
    searchParams,
    getRequestCatalogLocale(),
  ]);
  const copy = catalogCopy(locale);
  const query = q?.trim() ?? "";
  const hits = query ? await searchPublicProducts(query, locale) : [];
  // Sugestiile apar doar când nu e nimic de arătat: fără căutare sau fără rezultate.
  const showroom = hits.length === 0 ? await getShowroomData(locale) : null;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-28 md:pt-36">
      <div className="max-w-3xl">
        <h1 className="text-[1.625rem] font-medium leading-tight tracking-tight lg:text-[2rem]">
          {copy.search.title}
        </h1>
        <p className="mt-1.5 text-[15px] text-(--c-muted)">{copy.search.description}</p>
        <div className="mt-6">
          <Suspense>
            <SearchBox key={query} locale={locale} />
          </Suspense>
        </div>
      </div>

      {query && hits.length === 0 ? (
        <p className="mt-8 text-[15px] text-(--c-muted)" aria-live="polite">
          {copy.search.noResultsFor(query)}
        </p>
      ) : null}

      {hits.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {hits.map((hit, index) => (
            <PartCard
              key={hit.id}
              locale={locale}
              part={hit}
              meta={`${hit.brand} ${hit.model}, ${hit.type.toLowerCase()}`}
              priority={index < 4}
            />
          ))}
        </div>
      ) : null}

      {showroom ? (
        <div className="mt-12 space-y-12 border-t border-(--c-line) pt-10">
          <div>
            <h2 className="text-lg font-medium tracking-tight">{copy.search.tryCategory}</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-8 border-t border-(--c-line) sm:grid-cols-3 lg:grid-cols-4">
              {showroom.types.slice(0, 16).map((type) => (
                <Link
                  key={type.slug}
                  href={`${catalogHref(locale, "/cauta")}?q=${encodeURIComponent(type.name)}`}
                  className="truncate border-b border-(--c-line) py-3 text-[15px] transition-colors hover:text-(--c-accent)"
                >
                  {type.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-medium tracking-tight">{copy.search.tryBrand}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {showroom.brands.map((brand) => {
                const logo = brandLogo(brand.slug);
                return (
                  <Link
                    key={brand.slug}
                    href={catalogHref(locale, `/${brand.slug}`)}
                    title={brand.name}
                    className="group flex h-20 flex-col items-center justify-center gap-1.5 rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) p-3 transition-colors hover:border-(--c-accent)/50"
                  >
                    {logo ? (
                      <Image
                        src={logo}
                        alt=""
                        width={80}
                        height={40}
                        className="h-7 w-full object-contain"
                      />
                    ) : null}
                    <span className="max-w-full truncate text-xs font-medium text-(--c-muted) group-hover:text-(--c-accent)">
                      {brand.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
