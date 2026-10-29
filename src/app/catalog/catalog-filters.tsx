"use client";

import { useRouter, useSearchParams } from "next/navigation";
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

  return (
    <section className="motion-page border-b border-[#e4e4e7] bg-[#fafafa]">
      <div className="mx-auto grid max-w-[calc(100vw-2rem)] gap-2 px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_minmax(0,0.7fr)] lg:px-4">
        <TextFilterInput
          name="q"
          value={searchParams.get("q") ?? ""}
          onApply={updateParam}
          placeholder="Caută cod, model, descriere"
        />
        <select
          className="field-control h-9 rounded-md border border-[#e4e4e7] bg-white px-3 text-sm outline-none"
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
        <select
          className="field-control h-9 rounded-md border border-[#e4e4e7] bg-white px-3 text-sm outline-none"
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
        <select
          className="field-control h-9 rounded-md border border-[#e4e4e7] bg-white px-3 text-sm outline-none"
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
        <TextFilterInput
          name="year"
          value={searchParams.get("year") ?? ""}
          onApply={updateParam}
          placeholder="An, ex. 2010"
          inputMode="numeric"
        />
      </div>
    </section>
  );
}

type TextFilterInputProps = {
  name: string;
  value: string;
  placeholder: string;
  inputMode?: "numeric";
  onApply: (key: string, value: string) => void;
};

function TextFilterInput({
  name,
  value,
  placeholder,
  inputMode,
  onApply,
}: TextFilterInputProps) {
  function apply(value: string) {
    onApply(name, value.trim());
  }

  return (
    <div className="relative">
      <input
        className="field-control h-9 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm outline-none placeholder:text-[#71717a]"
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
