"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import {
  buildLabelPrintQuery,
  clampLabelCount,
  MAX_LABEL_COUNT,
  moveLabelItem,
  type LabelPrintFormat,
  type LabelSelectionItem,
} from "@/app/catalog/label-selection";
import { saveStickerFormat, updateStickers } from "@/app/catalog/sticker-store";

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
  skip,
  perSheet,
  items,
}: {
  size: LabelPrintFormat["size"];
  layout: LabelPrintFormat["layout"];
  skip: number;
  perSheet: number;
  items: LabelItem[];
}) {
  const router = useRouter();
  const [printed, setPrinted] = useState(false);
  const [cleared, setCleared] = useState(false);
  // Piesa trasă acum (din listă sau de pe foaie) și rândul de sub ea.
  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // După dialogul de print, butonul care scoate piesele din listă trece în față.
  useEffect(() => {
    const onAfterPrint = () => setPrinted(true);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  function go(nextItems: LabelItem[], format: LabelPrintFormat, nextSkip = skip) {
    const query = buildLabelPrintQuery(nextItems, format);
    if (format.layout === "grid" && nextSkip > 0) query.set("skip", String(nextSkip));
    router.replace(`/print/labels?${query.toString()}`);
  }

  function changeItems(nextItems: LabelItem[], nextSkip = skip) {
    const pageIds = new Set(items.map((item) => item.id));
    // Piesele adăugate între timp din CRM (alt tab) rămân în listă.
    updateStickers((current) => [
      ...nextItems,
      ...current.filter((item) => !pageIds.has(item.id)),
    ]);
    setCleared(false);
    go(nextItems, { size, layout }, nextSkip);
  }

  // Drag & drop pe foaie: celulele randate pe server au `data-cell` și
  // `data-sticker-id`. Lăsat peste alt sticker = schimbă ordinea; peste o
  // celulă hașurată = printul începe de acolo cu piesa asta prima.
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
      const id = cell?.dataset.stickerId;
      if (!cell || !id) return;
      dragId.current = id;
      event.dataTransfer?.setData("text/plain", id);
      event.dataTransfer?.setDragImage(cell, cell.offsetWidth / 2, cell.offsetHeight / 2);
      document
        .querySelectorAll(`[data-sticker-id="${CSS.escape(id)}"]`)
        .forEach((node) => node.classList.add("label-dragging"));
    }
    function onDragOver(event: DragEvent) {
      if (!dragId.current) return;
      const cell = cellAt(event);
      mark(cell);
      if (cell) event.preventDefault();
    }
    function onDrop(event: DragEvent) {
      const cell = cellAt(event);
      const from = dragId.current;
      // Curăță aici, nu doar la dragend: după re-randare celula sursă poate
      // dispărea și dragend nu mai ajunge la document.
      onDragEnd();
      if (!cell || !from) return;
      event.preventDefault();
      const toId = cell.dataset.stickerId;
      const index = Number(cell.dataset.cell);
      if (toId) {
        changeItems(moveLabelItem(items, from, items.findIndex((item) => item.id === toId)));
      } else if (index < skip) {
        changeItems(moveLabelItem(items, from, 0), index);
      } else {
        changeItems(moveLabelItem(items, from, items.length - 1));
      }
    }
    function onDragEnd() {
      dragId.current = null;
      mark(null);
      setOverId(null);
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
    go(items, format);
  }

  function setCount(id: string, count: number) {
    changeItems(items.map((it) => (it.id === id ? { ...it, count: clampLabelCount(count) } : it)));
  }

  function clearPrinted() {
    const pageIds = new Set(items.map((item) => item.id));
    updateStickers((current) => current.filter((item) => !pageIds.has(item.id)));
    setCleared(true);
  }

  const pdfHref = () => {
    const query = buildLabelPrintQuery(items, { size, layout });
    if (layout === "grid" && skip > 0) query.set("skip", String(skip));
    return `/api/export/labels?${query.toString()}`;
  };

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
              value={skip + 1}
              onChange={(event) => {
                const position = Math.min(Math.max(Number(event.target.value) || 1, 1), perSheet);
                go(items, { size, layout }, position - 1);
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
          {items.map((item, index) => (
            <div
              key={item.id}
              onDragOver={(event) => {
                if (!dragId.current) return;
                event.preventDefault();
                setOverId(dragId.current === item.id ? null : item.id);
              }}
              onDrop={(event) => {
                const from = dragId.current;
                if (!from) return;
                event.preventDefault();
                changeItems(moveLabelItem(items, from, index));
              }}
              className={`flex items-center gap-3 py-2 pr-3 pl-1 ${
                overId === item.id ? "bg-[#eef3fe]" : ""
              }`}
            >
              <span
                draggable
                onDragStart={(event) => {
                  dragId.current = item.id;
                  event.dataTransfer.setData("text/plain", item.id);
                  const row = event.currentTarget.parentElement;
                  if (row) event.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
                }}
                className="cursor-grab px-1 text-[#a09b91] hover:text-[#1b1a17] active:cursor-grabbing"
                aria-label={`Trage ca să muți ${item.code || item.name}`}
                title="Trage ca să schimbi ordinea"
              >
                <GripVertical className="size-4" aria-hidden="true" />
              </span>
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
