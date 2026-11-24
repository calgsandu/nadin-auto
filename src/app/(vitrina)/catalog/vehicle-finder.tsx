"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { catalogCopy, catalogHref, type CatalogLocale } from "@/lib/vitrina/i18n";
import type { VehicleIndexBrand } from "@/lib/vitrina/queries";
import { SearchBox } from "./cauta/search-box";

const selectClass =
  "h-12 w-full min-w-0 cursor-pointer appearance-none rounded-2xl border border-black/10 bg-[#f6f6f4] pl-4 pr-10 text-[15px] text-[#1b1a17] outline-none transition-colors hover:border-black/20 focus:border-[#2e90fa]/70 disabled:cursor-not-allowed disabled:opacity-50";

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
      className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 text-[#57534a]"
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
    `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-[#1b1a17] text-white" : "text-[#57534a] hover:bg-black/5 hover:text-[#1b1a17]"
    }`;

  return (
    <div className="rounded-[28px] border border-white/40 bg-white/95 p-2.5 text-left shadow-[0_30px_80px_-30px_rgb(0_0_0_/_0.55)] backdrop-blur-xl sm:p-3">
      <div role="tablist" className="flex gap-1 p-1">
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
          className="mt-2 grid gap-2 p-1 sm:grid-cols-[1fr_1fr_auto]"
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
            className="h-12 rounded-2xl bg-[#2e90fa] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1b7fe8] disabled:cursor-not-allowed disabled:bg-[#2e90fa]/45"
          >
            {copy.show}
          </button>
        </form>
      ) : (
        <div className="mt-2 p-1">
          <Suspense>
            <SearchBox locale={locale} autoFocus />
          </Suspense>
        </div>
      )}
    </div>
  );
}
