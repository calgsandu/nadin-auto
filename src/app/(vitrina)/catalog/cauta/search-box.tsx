"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  catalogCopy,
  catalogHref,
  type CatalogLocale,
} from "@/lib/vitrina/i18n";

export function SearchBox({ locale }: { locale: CatalogLocale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const copy = catalogCopy(locale).search;

  return (
    <form
      className="flex gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        const base = catalogHref(locale, "/cauta");
        router.push(query ? `${base}?q=${encodeURIComponent(query)}` : base);
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={copy.placeholder}
        className="w-full rounded-full border border-black/15 bg-white px-6 py-4 text-base text-[#1b1a17] outline-none transition-colors placeholder:text-[#98948b] focus:border-[#2e90fa]/70"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-[#2e90fa] px-7 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#1b7fe8]"
      >
        {copy.button}
      </button>
    </form>
  );
}
