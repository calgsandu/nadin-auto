"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarDays, Car, Layers, Search, Tag, X } from "lucide-react";
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
      {/* Cheia = valoarea din adresă: după „Resetează" câmpul se golește. */}
      <TextFilterInput
        key={`q:${searchParams.get("q") ?? ""}`}
        name="q"
        value={searchParams.get("q") ?? ""}
        onApply={updateParam}
        placeholder="Caută cod, model, descriere"
        icon={<Search className="size-4 text-[#71717a]" aria-hidden="true" />}
        className="w-full sm:w-72"
      />
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
          onClick={() => router.push(crmCatalogFilterHref(new URLSearchParams()))}
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
