"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  catalogCopy,
  catalogHref,
  type CatalogLocale,
} from "@/lib/vitrina/i18n";

export function SearchBox({
  locale,
  autoFocus = true,
}: {
  locale: CatalogLocale;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = catalogCopy(locale).search;

  return (
    <form
      role="search"
      className="flex gap-2 rounded-full border border-black/15 bg-white p-1.5 transition-colors focus-within:border-[#2e90fa]/70 sm:gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        const base = catalogHref(locale, "/cauta");
        router.push(query ? `${base}?q=${encodeURIComponent(query)}` : base);
      }}
    >
      <label className="flex min-w-0 flex-1 items-center gap-3 pl-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-5 shrink-0 text-[#98948b]"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="sr-only">{copy.button}</span>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="search"
          enterKeyHint="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={copy.placeholder}
          className="w-full min-w-0 bg-transparent py-2.5 text-base text-[#1b1a17] outline-none placeholder:text-[#98948b] [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-[#98948b] transition-colors hover:bg-black/5 hover:text-[#1b1a17]"
            aria-label={copy.clear}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        ) : null}
      </label>
      <button
        type="submit"
        className="shrink-0 rounded-full bg-[#2e90fa] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1b7fe8] sm:px-7"
      >
        {copy.button}
      </button>
    </form>
  );
}
