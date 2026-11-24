"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildLabelPrintQuery,
  clampLabelCount,
  MAX_LABEL_COUNT,
  type LabelPrintFormat,
  type LabelSelectionItem,
} from "@/app/catalog/label-selection";
import { saveStickerFormat, updateStickers } from "@/app/catalog/sticker-store";
import { encodeLabelCells } from "@/lib/labels/layout";

const SIZES = [
  { value: "s", label: "Mic (52×30 mm)" },
  { value: "m", label: "Mediu (70×42 mm, 21/foaie)" },
  { value: "l", label: "Mare (70×52 mm, 15/foaie)" },
] as const;

const LAYOUTS = [
  { value: "grid", label: "Foaie A4" },
  { value: "roll", label: "Rolă (1/pagină)" },
] as const;

export type LabelItem = LabelSelectionItem;

const field =
  "rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm text-[#1b1a17]";
const stepper =
  "h-7 w-7 rounded-md border border-[#e8e7e3] text-sm text-[#1b1a17] hover:bg-[#f6f6f4] disabled:opacity-40";

/**
 * Comenzile paginii de print. URL-ul e ce se printează (și ce primește PDF-ul);
 * orice schimbare de aici se scrie și în lista comună de stickere, ca bara din
 * CRM să rămână la fel cu ce vezi aici.
 */
export function LabelControls({
  size,
  layout,
  perSheet,
  cells,
  items,
}: {
  size: LabelPrintFormat["size"];
  layout: LabelPrintFormat["layout"];
  perSheet: number;
  /** Ce piesă stă în fiecare celulă (vezi `placeLabels`); null = goală. */
  cells: (string | null)[];
  items: LabelItem[];
}) {
  const router = useRouter();
  const [printed, setPrinted] = useState(false);
  const [cleared, setCleared] = useState(false);
  // Celula din care e tras stickerul acum.
  const dragFrom = useRef<number | null>(null);

  // După dialogul de print, butonul care scoate piesele din listă trece în față.
  useEffect(() => {
    const onAfterPrint = () => setPrinted(true);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  // null = așezare de la zero (la schimbarea formatului celulele nu mai corespund).
  function labelsQuery(nextItems: LabelItem[], format: LabelPrintFormat, nextCells: (string | null)[] | null) {
    const query = buildLabelPrintQuery(nextItems, format);
    if (format.layout === "grid" && nextCells) {
      query.set("cells", encodeLabelCells(nextCells, nextItems.map((item) => item.id)));
    }
    return query.toString();
  }

  function go(nextItems: LabelItem[], format: LabelPrintFormat, nextCells: (string | null)[] | null) {
    router.replace(`/print/labels?${labelsQuery(nextItems, format, nextCells)}`, { scroll: false });
  }

  const first = Math.max(cells.findIndex((id) => id !== null), 0);

  function changeItems(nextItems: LabelItem[]) {
    const pageIds = new Set(items.map((item) => item.id));
    // Piesele adăugate între timp din CRM (alt tab) rămân în listă.
    updateStickers((current) => [
      ...nextItems,
      ...current.filter((item) => !pageIds.has(item.id)),
    ]);
    setCleared(false);
    // Așezarea rămâne; serverul pune bucățile noi după ultimul sticker.
    go(nextItems, { size, layout }, cells);
  }

  // Drag & drop pe foaie: celulele randate pe server au `data-cell` și
  // `data-sticker-id`. Stickerul lăsat într-o celulă goală se mută acolo;
  // peste alt sticker, cele două schimbă locul.
  useEffect(() => {
    let target: HTMLElement | null = null;
    const cellAt = (event: Event) =>
      (event.target as Element | null)?.closest?.<HTMLElement>("[data-cell]") ?? null;
    const mark = (cell: HTMLElement | null) => {
      if (target === cell) return;
      target?.classList.remove("label-drop");
      target = cell;
      target?.classList.add("label-drop");
    };

    function onDragStart(event: DragEvent) {
      const cell = cellAt(event);
      if (!cell?.dataset.stickerId) return;
      dragFrom.current = Number(cell.dataset.cell);
      event.dataTransfer?.setData("text/plain", cell.dataset.stickerId);
      event.dataTransfer?.setDragImage(cell, cell.offsetWidth / 2, cell.offsetHeight / 2);
      cell.classList.add("label-dragging");
    }
    function onDragOver(event: DragEvent) {
      if (dragFrom.current === null) return;
      const cell = cellAt(event);
      mark(cell);
      if (cell) event.preventDefault();
    }
    function onDrop(event: DragEvent) {
      const cell = cellAt(event);
      const from = dragFrom.current;
      // Curăță aici, nu doar la dragend: după re-randare celula sursă poate
      // dispărea și dragend nu mai ajunge la document.
      onDragEnd();
      if (!cell || from === null) return;
      event.preventDefault();
      const to = Number(cell.dataset.cell);
      if (to === from) return;
      const next = [...cells];
      while (next.length <= Math.max(from, to)) next.push(null);
      [next[from], next[to]] = [next[to], next[from]];
      go(items, { size, layout }, next);
    }
    function onDragEnd() {
      dragFrom.current = null;
      mark(null);
      document.querySelectorAll(".label-dragging").forEach((node) => node.classList.remove("label-dragging"));
    }

    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragend", onDragEnd);
    return () => {
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
      document.removeEventListener("dragend", onDragEnd);
    };
  });

  function changeFormat(format: LabelPrintFormat) {
    saveStickerFormat(format);
    go(items, format, null);
  }

  function setCount(id: string, count: number) {
    changeItems(items.map((it) => (it.id === id ? { ...it, count: clampLabelCount(count) } : it)));
  }

  function clearPrinted() {
    const pageIds = new Set(items.map((item) => item.id));
    updateStickers((current) => current.filter((item) => !pageIds.has(item.id)));
    setCleared(true);
  }

  const pdfHref = () => `/api/export/labels?${labelsQuery(items, { size, layout }, cells)}`;

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 lg:w-auto">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[#6f6b63]">
          Format
          <select
            value={layout}
            onChange={(event) =>
              changeFormat({ size, layout: event.target.value === "roll" ? "roll" : "grid" })
            }
            className={field}
          >
            {LAYOUTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#6f6b63]">
          Mărime sticker
          <select
            value={size}
            onChange={(event) => {
              const value = event.target.value;
              changeFormat({ size: value === "s" || value === "m" ? value : "l", layout });
            }}
            className={field}
          >
            {SIZES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {layout === "grid" ? (
          <label className="flex flex-col gap-1 text-xs text-[#6f6b63]">
            Prima poziție
            <input
              type="number"
              min={1}
              max={perSheet}
              value={first + 1}
              onChange={(event) => {
                // Mută tot blocul, cu golurile lui, ca primul sticker să stea aici.
                const position = Math.min(Math.max(Number(event.target.value) || 1, 1), perSheet);
                go(items, { size, layout }, [
                  ...Array.from({ length: position - 1 }, () => null),
                  ...cells.slice(first),
                ]);
              }}
              className={`w-20 ${field}`}
            />
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
        >
          Printează
        </button>
        <a
          href={items.length > 0 ? pdfHref() : undefined}
          download
          aria-disabled={items.length === 0}
          className={`rounded-md border border-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-[#1b1a17] hover:bg-[#f0efec] ${
            items.length === 0 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Descarcă PDF
        </a>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={clearPrinted}
            disabled={cleared}
            className={`rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
              printed && !cleared
                ? "bg-[#1b1a17] text-white hover:bg-[#33312c]"
                : "text-[#6f6b63] hover:bg-[#f0efec]"
            }`}
          >
            {cleared ? "Scoase din listă" : "Gata, scoate din listă"}
          </button>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="max-h-64 divide-y divide-[#f0efec] overflow-y-auto rounded-md border border-[#e8e7e3] bg-white">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-bold text-[#1b1a17]">{item.code || "—"}</p>
                <p className="truncate text-xs text-[#6f6b63]">{item.name}</p>
                {item.alternativeCode ? (
                  <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[#6f6b63]">
                    <input
                      type="checkbox"
                      checked={item.includeAlternativeCode}
                      onChange={(event) => {
                        const include = event.currentTarget.checked;
                        changeItems(
                          items.map((it) => (it.id === item.id ? { ...it, includeAlternativeCode: include } : it)),
                        );
                      }}
                      className="size-3.5"
                    />
                    Și codul alternativ ({item.alternativeCode})
                  </label>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCount(item.id, item.count - 1)}
                  disabled={item.count <= 1}
                  className={stepper}
                  aria-label={`Mai puține stickere pentru ${item.code}`}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={MAX_LABEL_COUNT}
                  value={item.count}
                  onChange={(event) => setCount(item.id, Number(event.target.value))}
                  className="h-7 w-12 rounded-md border border-[#e8e7e3] text-center text-sm text-[#1b1a17]"
                  aria-label={`Număr stickere pentru ${item.code}`}
                />
                <button
                  type="button"
                  onClick={() => setCount(item.id, item.count + 1)}
                  disabled={item.count >= MAX_LABEL_COUNT}
                  className={stepper}
                  aria-label={`Mai multe stickere pentru ${item.code}`}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => changeItems(items.filter((it) => it.id !== item.id))}
                className="text-xs text-[#a09b91] hover:text-[#b3261e]"
                aria-label={`Scoate ${item.code}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
