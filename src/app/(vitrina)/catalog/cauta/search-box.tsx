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
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        const base = catalogHref(locale, "/cauta");
        router.push(query ? `${base}?q=${encodeURIComponent(query)}` : base);
      }}
    >
      <label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-(--c-line) bg-(--c-surface) pl-4 pr-1.5 transition-colors focus-within:border-(--c-accent)/70">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-5 shrink-0 text-(--c-muted-2)"
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
          className="w-full min-w-0 bg-transparent text-base text-(--c-ink) outline-none placeholder:text-(--c-muted-2) [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-(--c-muted-2) transition-colors hover:bg-(--c-hover) hover:text-(--c-ink)"
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
        className="h-12 shrink-0 rounded-full bg-(--c-accent) px-6 text-sm font-medium text-white transition-colors hover:bg-(--c-accent-hover)"
      >
        {copy.button}
      </button>
    </form>
  );
}
