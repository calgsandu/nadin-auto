import Link from "next/link";
import { Suspense } from "react";
import { searchPublicProducts } from "@/lib/vitrina/queries";
import { SearchBox } from "./search-box";
import { LocalBadge } from "@/app/components/local-badge";
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

  return (
    <section className="mx-auto max-w-4xl px-6 pb-24 pt-36 md:pt-44">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#2e90fa]">{copy.search.eyebrow}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">{copy.search.title}</h1>
      <p className="mt-4 text-[#6f6a61]">{copy.search.description}</p>
      <div className="mt-8">
        <Suspense>
          <SearchBox locale={locale} />
        </Suspense>
      </div>

      {query ? (
        <p className="mt-10 text-sm text-[#6f6a61]">
          {hits.length === 0
            ? locale === "ru"
              ? `По запросу «${query}» ничего не найдено. Попробуйте код или модель.`
              : `Nimic găsit pentru „${query}”. Încearcă un cod sau numele modelului.`
            : `${hits.length}${hits.length === 80 ? "+" : ""} ${copy.search.results(hits.length).replace(/^\d+\s*/, "")} · „${query}”`}
        </p>
      ) : (
        <p className="mt-10 text-sm text-[#6f6a61]">
          {copy.search.emptyQuery}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {hits.map((hit) => (
          <Link
            key={hit.id}
            href={catalogHref(locale, `/piesa/${hit.id}`)}
            className="group flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-5 transition-colors hover:border-[#2e90fa]/60 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-base font-medium leading-snug group-hover:text-[#2e90fa]">
                {hit.description}
              </p>
              <p className="mt-1.5 font-mono text-xs text-[#6f6a61]">
                {hit.code ?? "—"} · {hit.brand} {hit.model} · {hit.fitLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {hit.isLocal ? <LocalBadge locale={locale} /> : null}
              <span className="rounded-full border border-black/10 px-3 py-1 text-xs text-[#57534a]">
                {hit.type}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  hit.inStock
                    ? "bg-emerald-600/10 text-emerald-700"
                    : "bg-black/5 text-[#6f6a61]"
                }`}
              >
                {hit.inStock ? copy.common.inStock : copy.common.outOfStock}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
