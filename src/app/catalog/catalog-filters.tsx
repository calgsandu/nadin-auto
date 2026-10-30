"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { CalendarDays, Car, Layers, LoaderCircle, Search, Tag, X } from "lucide-react";
import type { Brand, CarModel, ProductType } from "@/generated/prisma/client";
import { crmCatalogFilterHref } from "@/lib/crm/urls";

type CatalogFiltersProps = {
  brands: Brand[];
  models: CarModel[];
  types: ProductType[];
};

export function CatalogFilters({
  brands,
  models,
  types,
}: CatalogFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [searching, startSearch] = useTransition();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  /** Căutarea filtrează pe loc, cu o mică pauză ca să nu cerem fiecare literă. */
  function changeQuery(value: string) {
    setQuery(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("page");
      // replace, nu push: „Înapoi" nu trebuie să treacă prin fiecare literă.
      startSearch(() => router.replace(crmCatalogFilterHref(next), { scroll: false }));
    }, 300);
  }

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    next.delete("page");

    if (key === "brand") {
      next.delete("model");
    }

    router.push(crmCatalogFilterHref(next));
  }

  const pill = (active: boolean) =>
    `field-control inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm ${
      active ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]" : "border-[#e4e4e7] bg-white text-[#3f3f46]"
    }`;
  const select = "min-w-0 max-w-40 cursor-pointer bg-transparent font-medium outline-none";

  return (
    <section className="motion-page flex flex-wrap items-center gap-2 px-3 pt-3 lg:px-6 lg:pt-4">
      <div className="relative w-full sm:w-80">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
          {searching ? (
            <LoaderCircle className="size-4 animate-spin text-[#2563eb]" aria-hidden="true" />
          ) : (
            <Search className="size-4 text-[#71717a]" aria-hidden="true" />
          )}
        </span>
        <input
          aria-label="Caută cod, mașină, piesă"
          autoComplete="off"
          className="field-control h-9 w-full rounded-lg border border-[#e4e4e7] bg-white pl-8 pr-12 text-sm outline-none placeholder:text-[#71717a]"
          data-catalog-search
          enterKeyHint="search"
          placeholder="Caută cod, mașină, piesă"
          value={query}
          onChange={(event) => changeQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              changeQuery("");
            }
          }}
        />
        {/* Scurtătura de la tastatură, ca s-o vadă lumea (vezi Sidebar). */}
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-[#e4e4e7] bg-white px-1 font-sans text-xs text-[#71717a] sm:block">
          Ctrl K
        </kbd>
      </div>
      <label className={pill(Boolean(searchParams.get("brand")))}>
        <Tag className="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span className="sr-only">Brand</span>
        <select
          className={select}
          value={searchParams.get("brand") ?? ""}
          onChange={(event) => updateParam("brand", event.target.value)}
        >
          <option value="">Toate brandurile</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      <label className={pill(Boolean(searchParams.get("model")))}>
        <Car className="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span className="sr-only">Model</span>
        <select
          className={select}
          value={searchParams.get("model") ?? ""}
          onChange={(event) => updateParam("model", event.target.value)}
        >
          <option value="">Toate modelele</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </label>
      <label className={pill(Boolean(searchParams.get("type")))}>
        <Layers className="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span className="sr-only">Tip produs</span>
        <select
          className={select}
          value={searchParams.get("type") ?? ""}
          onChange={(event) => updateParam("type", event.target.value)}
        >
          <option value="">Toate tipurile</option>
          {types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>
      <TextFilterInput
        key={`year:${searchParams.get("year") ?? ""}`}
        name="year"
        value={searchParams.get("year") ?? ""}
        onApply={updateParam}
        placeholder="An"
        inputMode="numeric"
        icon={<CalendarDays className="size-4 text-[#71717a]" aria-hidden="true" />}
        className="w-28"
      />
      {searchParams.toString() ? (
        <button
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b]"
          type="button"
          onClick={() => {
            window.clearTimeout(timer.current);
            setQuery("");
            router.push(crmCatalogFilterHref(new URLSearchParams()));
          }}
        >
          <X className="size-4" aria-hidden="true" /> Resetează
        </button>
      ) : null}
    </section>
  );
}

type TextFilterInputProps = {
  name: string;
  value: string;
  placeholder: string;
  inputMode?: "numeric";
  icon?: ReactNode;
  className?: string;
  onApply: (key: string, value: string) => void;
};

function TextFilterInput({
  name,
  value,
  placeholder,
  inputMode,
  icon,
  className = "",
  onApply,
}: TextFilterInputProps) {
  function apply(value: string) {
    onApply(name, value.trim());
  }

  return (
    <div className={`relative ${className}`}>
      {icon ? <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">{icon}</span> : null}
      <input
        aria-label={placeholder}
        className={`field-control h-9 w-full rounded-lg border border-[#e4e4e7] bg-white text-sm outline-none placeholder:text-[#71717a] ${icon ? "pl-8 pr-3" : "px-3"}`}
        defaultValue={value}
        inputMode={inputMode}
        onBlur={(event) => apply(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
      />
    </div>
  );
}
