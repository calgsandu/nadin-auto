"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Search, X } from "lucide-react";

/**
 * Căutarea din pagina de start. Rezultatele vin pe loc, pe măsură ce scrii
 * (cu o mică pauză, ca să nu cerem serverului fiecare literă); marca și
 * modelul alese din butoane rămân în adresă alături de text.
 */
export function ProductFinder() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
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

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        window.clearTimeout(timer.current);
        apply({ q: query.trim() });
      }}
    >
      <label className="flex h-12 items-center gap-3 rounded-xl border border-[#d4d4d8] bg-white px-4 shadow-sm focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/10">
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
          placeholder="Caută: cod, mașină sau piesă"
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
  );
}
