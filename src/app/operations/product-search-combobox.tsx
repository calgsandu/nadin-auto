"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { focusNextField } from "@/app/components/operation-drawer";
import type { ProductSearchResult } from "@/lib/catalog/product-search";
import { placeDropdown, type DropdownBox } from "@/lib/operations/dropdown-position";

export function ProductSearchCombobox({
  name = "productId",
  showHint = true,
  initialProduct,
  onSelect,
  onClear,
  excludedProductIds = [],
}: {
  name?: string;
  showHint?: boolean;
  initialProduct?: { id: string; label: string } | null;
  onSelect?: (product: ProductSearchResult) => void;
  onClear?: () => void;
  excludedProductIds?: string[];
}) {
  const id = useId();
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState(initialProduct?.label ?? "");
  const [selected, setSelected] = useState<{ id: string; label: string } | null>(
    initialProduct ?? null,
  );
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [box, setBox] = useState<DropdownBox | null>(null);
  // Produsul ales se vede ca fișă (text integral, pe câte rânduri e nevoie);
  // dublu-click îl transformă înapoi în câmp de căutare.
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const excludedIds = new Set(excludedProductIds);
  const visibleResults = results.filter((product) => !excludedIds.has(product.id));
  const onlyExcludedResults = results.length > 0 && visibleResults.length === 0;

  useEffect(() => {
    const normalized = query.trim();

    // Cât timp rândul are produs (inclusiv la editarea codului) nu se caută:
    // prima tastă îl deselectează și abia atunci pornește căutarea.
    if (selected) {
      return;
    }

    if (normalized.length < 3) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/products/search?q=${encodeURIComponent(normalized)}`,
        );
        const data = (await response.json()) as { products?: ProductSearchResult[] };

        if (requestIdRef.current === requestId) {
          setResults(data.products ?? []);
          setActiveIndex(0);
          setOpen(true);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [query, selected]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  /**
   * Lista trăiește într-un portal pe body: drawerul are `overflow-y-auto`, deci
   * orice popover ancorat în el era tăiat sau ieșea din ecran. Stă DEASUPRA
   * câmpului (ca să nu acopere rândurile de sub el) și coboară doar când sus nu
   * încape; înălțimea se strânge la spațiul disponibil.
   */
  useLayoutEffect(() => {
    // La închidere nu resetăm nimic: portalul nu se mai randează, iar poziția
    // se recalculează oricum la următoarea deschidere.
    if (!open) return;

    function place() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBox(placeDropdown(rect, window.innerHeight));
    }

    place();
    // Poziția se recalculează la scroll (inclusiv în drawer) și la redimensionare.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, visibleResults.length, loading]);

  function selectProduct(product: ProductSearchResult) {
    setSelected(product);
    setQuery(product.label);
    setOpen(false);
    setEditing(false);
    // Rezultatele vechi nu mai au ce căuta: altfel refocalizarea câmpului
    // redeschidea o listă care n-are legătură cu produsul ales.
    setResults([]);
    onSelect?.(product);
  }

  /** Săgeți prin rezultate, Enter alege și sare la cantitate. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (!open) {
        // Lista e închisă: Escape renunță la editare, altfel închide drawerul.
        if (cancelEditing()) event.stopPropagation();
        return;
      }
      event.stopPropagation();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (visibleResults.length === 0) return;
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        Math.min(Math.max(current + step, 0), visibleResults.length - 1),
      );
      return;
    }

    if (event.key === "Enter") {
      const product = open ? visibleResults[activeIndex] : undefined;
      if (!product) return; // fără rezultat: navigarea Enter a formularului preia
      event.preventDefault();
      // Nu lăsa formularul să mai avanseze o dată peste câmpul de cantitate.
      event.stopPropagation();
      selectProduct(product);
      if (inputRef.current) focusNextField(inputRef.current);
    }
  }

  const showCard = Boolean(selected) && !editing;

  /** Editezi doar codul, nu toată eticheta; textul e selectat, deci o tastă îl înlocuiește. */
  function startEditing() {
    setEditing(true);
    setQuery(productCode(selected?.label ?? ""));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  /** Ieșire fără modificare: produsul rămâne ales, fișa se pune la loc. */
  function cancelEditing() {
    const current = selectedRef.current;
    if (!current) return false;
    setQuery(current.label);
    setEditing(false);
    return true;
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={selected?.id ?? ""} />
      {showCard ? (
        <ProductCard label={selected?.label ?? ""} onEdit={startEditing} />
      ) : null}
      <div className={`relative ${showCard ? "hidden" : ""}`}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f6b63]"
          aria-hidden="true"
        />
        <input
          aria-autocomplete="list"
          aria-controls={`${id}-results`}
          aria-expanded={open}
          className="field-control h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-9 text-sm outline-none placeholder:text-[#98948b]"
          // Ascuns sub fișă: navigarea cu Enter trebuie să sară peste el.
          data-enter-skip={showCard ? "" : undefined}
          placeholder="Caută cod, brand, model sau descriere"
          ref={inputRef}
          role="combobox"
          value={query}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              cancelEditing();
            }, 120);
          }}
          onChange={(event) => {
            const nextQuery = event.currentTarget.value;
            if (selected) onClear?.();
            setSelected(null);
            setQuery(nextQuery);
            setActiveIndex(0);

            if (nextQuery.trim().length < 3) {
              setResults([]);
              setLoading(false);
              setOpen(false);
            } else {
              setLoading(true);
            }
          }}
          onFocus={() => {
            if (!selected && results.length > 0) {
              setOpen(true);
            }
          }}
        />
      </div>

      {open && box
        ? createPortal(
        <div
          className="motion-popover fixed z-[60] overflow-auto rounded-md border border-[#e8e7e3] bg-white shadow-lg"
          id={`${id}-results`}
          role="listbox"
          style={{
            left: box.left,
            top: box.top,
            bottom: box.bottom,
            width: box.width,
            maxHeight: box.maxHeight,
          }}
        >
          {loading && visibleResults.length > 0 ? (
            // Rezultatele afișate sunt încă cele de la tasta anterioară.
            <div className="sticky top-0 border-b border-[#efeeeb] bg-[#fafaf9] px-3 py-1.5 text-xs font-semibold text-[#6f6b63]">
              Se caută...
            </div>
          ) : null}
          {visibleResults.length > 0 ? (
            visibleResults.map((product, index) => (
              <button
                key={product.id}
                ref={index === activeIndex ? activeItemRef : null}
                aria-selected={index === activeIndex}
                className={`button-secondary block w-full border-b border-[#efeeeb] px-3 py-2.5 text-left text-sm text-[#1b1a17] ${
                  index === activeIndex ? "bg-[#dbebfe]" : "hover:bg-[#f6f6f4]"
                }`}
                role="option"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectProduct(product)}
              >
                <span className="block font-semibold leading-5">{product.label}</span>
                <span className="mt-1 flex items-center gap-2 font-mono text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      product.stock > 0 ? "bg-[#f0fdf4] text-[#166534]" : "bg-[#fef2f2] text-[#b91c1c]"
                    }`}
                  >
                    Stoc: {product.stock}
                  </span>
                  <span className="text-[#6f6b63]">
                    {product.salePriceLei ? `${product.salePriceLei} lei` : "fără preț"}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm font-medium text-[#6f6b63]">
              {loading
                ? "Se caută..."
                : onlyExcludedResults
                  ? "Produsul este deja adăugat pe altă poziție."
                  : "Nu am găsit produse pentru căutarea curentă."}
            </div>
          )}
        </div>,
        document.body,
          )
        : null}

      {showHint && !showCard ? (
        <p className="mt-1 text-xs font-medium text-[#6f6b63]">
          Scrie cel puțin 3 caractere. ↑↓ alegi, Enter treci la cantitate.
        </p>
      ) : null}
    </div>
  );
}

/** Codul produsului = prima bucată din etichetă („COD · MARCĂ MODEL · tip · ..."). */
function productCode(label: string) {
  return label.split(" · ")[0] ?? "";
}

/**
 * Fișa produsului ales — aceeași citire ca în „Detalii operațiune": codul
 * îngroșat, restul dedesubt, text integral (etichetele lungi nu mai sunt tăiate).
 */
function ProductCard({ label, onEdit }: { label: string; onEdit: () => void }) {
  const [code, ...rest] = label.split(" · ");

  return (
    <div
      className="min-h-11 cursor-text rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm leading-5"
      role="button"
      tabIndex={0}
      title="Dublu-click ca să schimbi produsul"
      onDoubleClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          onEdit();
        }
      }}
    >
      <span className="font-mono font-semibold text-[#1b1a17]">{code}</span>
      {rest.length > 0 ? (
        <span className="ml-2 text-[#33312c]">{rest.join(", ")}</span>
      ) : null}
    </div>
  );
}
