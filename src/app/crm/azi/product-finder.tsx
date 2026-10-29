"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Search, X } from "lucide-react";

/**
 * Căutarea din pagina de start. Rezultatele vin pe loc, pe măsură ce scrii
 * (cu o mică pauză, ca să nu cerem serverului fiecare literă); marca, modelul
 * și tipul alese din butoane rămân în adresă alături de text.
 */
export function ProductFinder() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [year, setYear] = useState(searchParams.get("an") ?? "");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  function apply(changes: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("pagina");
    const search = params.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  }

  function schedule(changes: Record<string, string>) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => apply(changes), 280);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const inStock = searchParams.get("stoc") === "1";

  return (
    <div className="grid gap-2">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          window.clearTimeout(timer.current);
          apply({ q: query.trim() });
        }}
      >
        <label className="flex h-14 items-center gap-3 rounded-xl border border-[#d4d4d8] bg-white px-4 shadow-sm focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/10">
          {pending ? (
            <LoaderCircle className="size-5 shrink-0 animate-spin text-[#2563eb]" aria-hidden="true" />
          ) : (
            <Search className="size-5 shrink-0 text-[#71717a]" aria-hidden="true" />
          )}
          <span className="sr-only">Caută o piesă</span>
          <input
            ref={inputRef}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-lg text-[#18181b] outline-none placeholder:text-base placeholder:text-[#71717a]"
            enterKeyHint="search"
            name="q"
            placeholder="Cod, mașină sau piesă — ex. „golf 5 stop”, „P12013”"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              schedule({ q: event.target.value.trim() });
            }}
          />
          {query ? (
            <button
              aria-label="Șterge căutarea"
              className="grid size-8 place-items-center rounded-md text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]"
              type="button"
              onClick={() => {
                setQuery("");
                apply({ q: "" });
                inputRef.current?.focus();
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </label>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex h-8 items-center gap-2 rounded-md border border-[#e4e4e7] bg-white px-2.5 text-[#52525b]">
          An fabricație
          <input
            className="w-14 bg-transparent text-[#18181b] outline-none placeholder:text-[#a1a1aa]"
            inputMode="numeric"
            maxLength={4}
            placeholder="2010"
            value={year}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, "");
              setYear(value);
              if (value.length === 0 || value.length === 4) schedule({ an: value });
            }}
          />
        </label>
        <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-[#e4e4e7] bg-white px-2.5 text-[#52525b]">
          <input
            checked={inStock}
            className="size-4 accent-[#2563eb]"
            type="checkbox"
            onChange={(event) => apply({ stoc: event.target.checked ? "1" : "" })}
          />
          Doar în stoc
        </label>
      </div>
    </div>
  );
}
