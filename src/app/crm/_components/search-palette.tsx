"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { normalizeProductSearchQuery, type ProductSearchResult } from "@/lib/catalog/product-search";
import { formatMoney } from "./format";
import { StatusBadge } from "./ui";

/** Evenimentul cu care câmpul de căutare din Produse preia termenul ales aici. */
export const CATALOG_SEARCH_EVENT = "catalog-search:set";

/**
 * Căutarea din bara de sus: o bară mare în centrul ecranului, cu piesele
 * găsite chiar sub ea. Ctrl+K (sau „/" când nu scrii într-un câmp) o deschide
 * de oriunde din CRM. Enter sau click duce piesa în Produse.
 */
export function SearchPalette() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; products: ProductSearchResult[] } | null>(null);
  const [active, setActive] = useState(0);
  const q = normalizeProductSearchQuery(query);
  const results = found && found.q === q ? found.products : [];
  const loading = Boolean(q) && found?.q !== q;

  const open = useCallback(() => {
    if (!dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    input.current?.select();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable;
      const shortcut =
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") ||
        (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey);
      if (!shortcut) return;
      // Cu un panou deschis nu facem nimic: ar pierde ciorna din ochi.
      const drawerOpen = Array.from(document.querySelectorAll<HTMLElement>(".motion-drawer-backdrop")).some(
        (backdrop) => backdrop.style.display !== "none",
      );
      if (drawerOpen) return;
      event.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = response.ok ? ((await response.json()) as { products: ProductSearchResult[] }) : { products: [] };
        setFound({ q, products: data.products });
        setActive(0);
      } catch {
        if (!controller.signal.aborted) setFound({ q, products: [] });
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  function go(term: string) {
    dialog.current?.close();
    window.dispatchEvent(new CustomEvent(CATALOG_SEARCH_EVENT, { detail: term }));
    router.push(`/crm/produse?q=${encodeURIComponent(term)}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Caută piese (Ctrl K)"
        title="Caută piese (Ctrl K)"
        className="grid size-9 place-items-center rounded-full border border-(--c-line) bg-(--c-surface) text-(--c-ink) hover:border-(--c-line-strong)"
      >
        <Search className="size-4" aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        aria-label="Caută piese"
        className="crm-search-palette m-0 mx-auto mt-[12vh] w-[min(42rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-(--c-line) bg-(--c-surface) p-0 text-(--c-ink) shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] backdrop:bg-black/40 max-sm:mt-3"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <form
          className="flex items-center gap-3 px-5"
          onSubmit={(event) => {
            event.preventDefault();
            const pick = results[active];
            const term = pick ? pick.code || pick.description || "" : query.trim();
            if (term) go(term);
          }}
        >
          {loading ? (
            <LoaderCircle className="size-5 shrink-0 animate-spin text-(--c-accent)" aria-hidden="true" />
          ) : (
            <Search className="size-5 shrink-0 text-(--c-muted-2)" aria-hidden="true" />
          )}
          <input
            ref={input}
            aria-label="Cod, mașină, piesă"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Cod, mașină, piesă"
            className="h-16 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-(--c-muted-2)"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              if (results.length === 0) return;
              setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
            }}
          />
          <kbd className="hidden rounded border border-(--c-line) px-1.5 py-0.5 font-sans text-xs text-(--c-muted-2) sm:block">Esc</kbd>
        </form>

        {q ? (
          <div className="max-h-[min(60vh,32rem)] overflow-y-auto border-t border-(--c-line) p-2">
            {results.length > 0 ? (
              <ul role="listbox" aria-label="Piese găsite">
                {results.map((product, index) => (
                  <li key={product.id} role="option" aria-selected={index === active}>
                    <button
                      type="button"
                      onMouseMove={() => setActive(index)}
                      onClick={() => go(product.code || product.description || q)}
                      className={`flex w-full items-center gap-3 rounded-xl sm:gap-4 px-3 py-2.5 text-left ${
                        index === active ? "bg-(--c-hover)" : ""
                      }`}
                    >
                      <span className="w-20 shrink-0 truncate text-xs font-semibold tabular-nums sm:w-24 sm:text-sm">{product.code ?? "-"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm max-sm:line-clamp-2 sm:truncate">{product.description}</span>
                        {product.vehicles ? (
                          <span className="block truncate text-xs text-(--c-muted)">{product.vehicles}</span>
                        ) : null}
                      </span>
                      {product.salePriceLei ? (
                        <span className="shrink-0 text-sm tabular-nums text-(--c-ink-2) max-sm:hidden">
                          {formatMoney(product.salePriceLei)} lei
                        </span>
                      ) : null}
                      <StatusBadge tone={product.stock <= 0 ? "red" : product.stock <= 3 ? "amber" : "green"}>
                        {product.stock}
                      </StatusBadge>
                    </button>
                  </li>
                ))}
              </ul>
            ) : loading ? null : (
              <p className="px-3 py-6 text-center text-sm text-(--c-muted)">Nicio piesă pentru „{q}”.</p>
            )}
            {results.length > 0 ? (
              <button
                type="button"
                onClick={() => go(query.trim())}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-(--c-accent-strong) hover:bg-(--c-hover)"
              >
                Toate rezultatele în Produse
              </button>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
