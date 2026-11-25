"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { catalogCopy, catalogHref, type CatalogLocale } from "@/lib/vitrina/i18n";
import type { VehicleIndexBrand } from "@/lib/vitrina/queries";
import { SearchBox } from "./cauta/search-box";

const selectClass =
  "h-12 w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-(--c-line) bg-(--c-surface) pl-4 pr-10 text-[15px] text-(--c-ink) outline-none transition-colors hover:border-(--c-line-strong) focus:border-(--c-accent)/70 disabled:cursor-not-allowed disabled:opacity-50";

function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 text-(--c-muted)"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

/**
 * Căutarea din hero: întâi „Marcă → Model” (cum caută clientul o piesă de
 * caroserie), iar pe al doilea tab căutarea liberă după cod sau denumire.
 */
export function VehicleFinder({
  locale,
  brands,
}: {
  locale: CatalogLocale;
  brands: VehicleIndexBrand[];
}) {
  const router = useRouter();
  const copy = catalogCopy(locale).picker;
  const [tab, setTab] = useState<"car" | "text">("car");
  const [brandSlug, setBrandSlug] = useState("");
  const [modelSlug, setModelSlug] = useState("");
  const brand = brands.find((entry) => entry.slug === brandSlug);

  const tabClass = (active: boolean) =>
    `-mb-px border-b-2 pb-2.5 pt-1 text-[15px] font-medium transition-colors ${
      active
        ? "border-(--c-accent) text-(--c-ink)"
        : "border-transparent text-(--c-muted) hover:text-(--c-ink)"
    }`;

  return (
    <div className="rounded-[1.25rem] bg-(--c-surface) p-3 text-left sm:p-4">
      <div role="tablist" className="flex gap-6 border-b border-(--c-line) px-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "car"}
          className={tabClass(tab === "car")}
          onClick={() => setTab("car")}
        >
          {copy.byCar}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "text"}
          className={tabClass(tab === "text")}
          onClick={() => setTab("text")}
        >
          {copy.byText}
        </button>
      </div>

      {tab === "car" ? (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!brandSlug) return;
            router.push(
              catalogHref(locale, modelSlug ? `/${brandSlug}/${modelSlug}` : `/${brandSlug}`),
            );
          }}
        >
          <label className="relative min-w-0">
            <span className="sr-only">{copy.brand}</span>
            <select
              className={selectClass}
              value={brandSlug}
              onChange={(event) => {
                setBrandSlug(event.target.value);
                setModelSlug("");
              }}
            >
              <option value="">{copy.chooseBrand}</option>
              {brands.map((entry) => (
                <option key={entry.slug} value={entry.slug}>
                  {entry.name}
                </option>
              ))}
            </select>
            <Chevron />
          </label>
          <label className="relative min-w-0">
            <span className="sr-only">{copy.model}</span>
            <select
              className={selectClass}
              value={modelSlug}
              disabled={!brand}
              onChange={(event) => setModelSlug(event.target.value)}
            >
              <option value="">{brand ? copy.allModels : copy.chooseModel}</option>
              {brand?.models.map((model) => (
                <option key={model.slug} value={model.slug}>
                  {model.name}
                </option>
              ))}
            </select>
            <Chevron />
          </label>
          <button
            type="submit"
            disabled={!brandSlug}
            className="h-12 rounded-full bg-(--c-accent) px-6 text-sm font-medium text-white transition-colors hover:bg-(--c-accent-hover) disabled:cursor-not-allowed disabled:bg-(--c-accent)/45"
          >
            {copy.show}
          </button>
        </form>
      ) : (
        <div className="mt-3">
          <Suspense>
            <SearchBox locale={locale} autoFocus />
          </Suspense>
        </div>
      )}
    </div>
  );
}
