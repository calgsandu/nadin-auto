import Link from "next/link";
import { Suspense } from "react";
import { searchPublicProducts } from "@/lib/vitrina/queries";
import { SearchBox } from "./search-box";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const hits = query ? await searchPublicProducts(query) : [];

  return (
    <section className="mx-auto max-w-4xl px-6 pb-24 pt-36 md:pt-44">
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
        Caută o piesă.
      </h1>
      <div className="mt-8">
        <Suspense>
          <SearchBox />
        </Suspense>
      </div>

      {query ? (
        <p className="mt-10 text-sm text-[#8f887c]">
          {hits.length === 0
            ? `Nimic găsit pentru „${query}”. Încearcă un cod sau numele modelului.`
            : `${hits.length}${hits.length === 80 ? "+" : ""} rezultate pentru „${query}”`}
        </p>
      ) : (
        <p className="mt-10 text-sm text-[#8f887c]">
          Caută după codul piesei, denumire, marcă sau model — de exemplu „Prag
          Vito” sau „131501”.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {hits.map((hit) => (
          <Link
            key={hit.id}
            href={`/catalog/piesa/${hit.id}`}
            className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-[#d97706]/60 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-base font-medium leading-snug group-hover:text-[#d97706]">
                {hit.description}
              </p>
              <p className="mt-1.5 font-mono text-xs text-[#8f887c]">
                {hit.code ?? "—"} · {hit.brand} {hit.model} · {hit.fitLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-[#b5afa4]">
                {hit.type}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  hit.inStock
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-white/5 text-[#8f887c]"
                }`}
              >
                {hit.inStock ? "În stoc" : "La comandă"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
