"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ProductSearchResult } from "@/lib/catalog/product-search";

export function ProductSearchCombobox({
  name = "productId",
  showHint = true,
  initialProduct,
  onSelect,
}: {
  name?: string;
  showHint?: boolean;
  initialProduct?: { id: string; label: string } | null;
  onSelect?: (product: ProductSearchResult) => void;
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

  useEffect(() => {
    const normalized = query.trim();

    if (selected?.label === query) {
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
          setOpen(true);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [query, selected?.label]);

  function selectProduct(product: ProductSearchResult) {
    setSelected(product);
    setQuery(product.label);
    setOpen(false);
    onSelect?.(product);
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={selected?.id ?? ""} />
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#68746d]"
          aria-hidden="true"
        />
        <input
          aria-autocomplete="list"
          aria-controls={`${id}-results`}
          aria-expanded={open}
          className="field-control h-11 w-full rounded-md border border-[#d8d2c6] bg-white px-9 text-sm outline-none placeholder:text-[#8a918d]"
          placeholder="Caută cod, brand, model sau descriere"
          role="combobox"
          value={query}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            const nextQuery = event.currentTarget.value;
            setSelected(null);
            setQuery(nextQuery);

            if (nextQuery.trim().length < 3) {
              setResults([]);
              setLoading(false);
              setOpen(false);
            } else {
              setLoading(true);
            }
          }}
          onFocus={() => {
            if (results.length > 0) {
              setOpen(true);
            }
          }}
        />
      </div>

      {open ? (
        <div
          className="motion-popover absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-md border border-[#d8d2c6] bg-white shadow-lg"
          id={`${id}-results`}
          role="listbox"
        >
          {results.length > 0 ? (
            results.map((product) => (
              <button
                key={product.id}
                className="button-secondary block w-full border-b border-[#e7e2d8] px-3 py-2.5 text-left text-sm text-[#1d2521] hover:bg-[#f4f2ec]"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectProduct(product)}
              >
                <span className="block font-semibold leading-5">{product.label}</span>
                <span className="mt-1 flex items-center gap-2 font-mono text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      product.stock > 0 ? "bg-[#eef6e6] text-[#334719]" : "bg-[#fff1eb] text-[#7a2f13]"
                    }`}
                  >
                    Stoc: {product.stock}
                  </span>
                  <span className="text-[#68746d]">
                    {product.salePriceLei ? `${product.salePriceLei} lei` : "fără preț"}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm font-medium text-[#68746d]">
              {loading ? "Se caută..." : "Nu am găsit produse pentru căutarea curentă."}
            </div>
          )}
        </div>
      ) : null}

      {showHint ? (
        <p className="mt-1 text-xs font-medium text-[#68746d]">
          Scrie cel puțin 3 caractere. Rezultatele sunt limitate server-side.
        </p>
      ) : null}
    </div>
  );
}
