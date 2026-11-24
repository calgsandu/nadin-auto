"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, ListOrdered, Minus, Plus, Printer, X } from "lucide-react";
import {
  buildLabelPrintQuery,
  fillLabelDetails,
  MAX_LABEL_COUNT,
  MIN_LABEL_COUNT,
  setLabelAlternativeCode,
  setLabelCount,
} from "@/app/catalog/label-selection";
import { stickerDetailsAction } from "@/app/catalog/sticker-actions";
import { clearStickers, readStickerFormat, updateStickers, useStickers } from "@/app/catalog/sticker-store";

/**
 * Bara de jos cu lista de stickere, aceeași pe toate paginile CRM-ului. Apare
 * cât lista are ceva, oriunde ar fi fost adăugat (Produse, recepție, inventar,
 * fișa produsului), și printează tot deodată.
 */
export function StickerTray() {
  const items = useStickers();
  const listRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);
  const requested = useRef(new Set<string>());
  // Bara pornește strânsă; lista de cantități se deschide la cerere.
  const [expanded, setExpanded] = useState(false);

  // Produsul nou intră la coada listei — sari direct la el, fără scroll manual.
  useEffect(() => {
    const list = listRef.current;
    if (list && items.length > previousCount.current) {
      list.scrollTop = list.scrollHeight;
    }
    previousCount.current = items.length;
  }, [items.length, expanded]);

  // Rândurile venite din recepție/inventar au doar id-ul: codul și denumirea
  // se cer o singură dată, pentru toate deodată.
  useEffect(() => {
    const missing = items
      .filter((item) => !item.code && !item.name && !requested.current.has(item.id))
      .map((item) => item.id);
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    stickerDetailsAction(missing).then(
      (details) => updateStickers((current) => fillLabelDetails(current, details)),
      () => missing.forEach((id) => requested.current.delete(id)),
    );
  }, [items]);

  if (items.length === 0) return null;

  function remove(id: string) {
    updateStickers((current) => current.filter((item) => item.id !== id));
  }

  function updateCount(id: string, count: number) {
    updateStickers((current) => setLabelCount(current, id, count));
  }

  function updateAlternativeCode(id: string, include: boolean) {
    updateStickers((current) => setLabelAlternativeCode(current, id, include));
  }

  function clear() {
    clearStickers();
    setExpanded(false);
  }

  // Link real, nu `window.open`: popupurile programatice sunt blocate în
  // Chromium-urile hardened (Helium) și butonul pare mort.
  // Formatul ales ultima dată la print (lista goală pe server, deci aici e doar client).
  const printHref = `/print/labels?${buildLabelPrintQuery(items, readStickerFormat()).toString()}`;
  const stickerCount = items.reduce((total, item) => total + item.count, 0);

  return (
    <>
      {/* Loc sub ultimul rând al paginii, ca bara să nu-l acopere. */}
      <div aria-hidden="true" className={expanded ? "h-[22rem]" : "h-24"} />
      {/* portal la body: strămoșii cu transform (motion-page/gsap) ar face fixed relativ la ei */}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 print:hidden sm:bottom-4 sm:px-4">
          <div className="pointer-events-auto w-full max-w-xl overflow-hidden crm-card shadow-[0_12px_40px_rgb(24_24_27/0.18)]">
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div
                className="min-h-0 overflow-hidden"
                aria-hidden={!expanded}
                inert={!expanded ? true : undefined}
              >
                <div className="border-b border-(--c-line) bg-(--c-surface-2)">
                  <div className="flex items-center justify-between gap-4 border-b border-(--c-line-2) px-3 py-2 sm:px-4">
                    <div>
                      <p className="text-sm font-semibold text-(--c-ink)">
                        Cantități pentru print
                      </p>
                      <p className="mt-0.5 text-xs text-(--c-muted-2)">
                        {stickerCount} {stickerCount === 1 ? "sticker" : "stickere"} în total
                      </p>
                    </div>
                  </div>

                  <div
                    ref={listRef}
                    className="max-h-[min(32vh,14rem)] divide-y divide-(--c-line-2) overflow-y-auto overscroll-contain"
                  >
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 sm:px-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-bold tracking-[0.02em] text-(--c-ink)">
                            {item.code || "—"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-(--c-muted-2)">
                            {item.name || "Produs selectat"}
                          </p>
                          {item.compatibility ? (
                            <p className="mt-0.5 truncate text-[11px] text-(--c-muted-2)">
                              {item.compatibility}
                            </p>
                          ) : null}
                          <label
                            className={`mt-1.5 inline-flex items-center gap-1.5 text-[11px] ${
                              item.alternativeCode
                                ? "cursor-pointer text-(--c-muted)"
                                : "cursor-not-allowed text-(--c-faint)"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.includeAlternativeCode}
                              disabled={!item.alternativeCode}
                              onChange={(event) =>
                                updateAlternativeCode(
                                  item.id,
                                  event.currentTarget.checked,
                                )
                              }
                              className="size-3.5 accent-(--c-accent)"
                            />
                            <span>
                              {item.alternativeCode
                                ? `Include cod alternativ (${item.alternativeCode})`
                                : "Fără cod alternativ"}
                            </span>
                          </label>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCount(item.id, item.count - 1)}
                            disabled={item.count <= MIN_LABEL_COUNT}
                            className="grid size-8 place-items-center rounded-full border border-(--c-line-strong) bg-(--c-surface) text-(--c-ink) transition-colors hover:border-(--c-faint) hover:bg-(--c-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--c-accent) disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label={`Mai puține stickere pentru ${item.code || item.name}`}
                          >
                            <Minus aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={MIN_LABEL_COUNT}
                            max={MAX_LABEL_COUNT}
                            value={item.count}
                            onChange={(event) =>
                              updateCount(item.id, Number(event.currentTarget.value))
                            }
                            className="h-8 w-11 rounded-lg border border-(--c-line-strong) bg-(--c-surface) text-center font-mono text-sm font-bold text-(--c-ink) [appearance:textfield] focus:border-(--c-accent) focus:outline-none focus:ring-1 focus:ring-(--c-accent) [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            aria-label={`Număr stickere pentru ${item.code || item.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => updateCount(item.id, item.count + 1)}
                            disabled={item.count >= MAX_LABEL_COUNT}
                            className="grid size-8 place-items-center rounded-full border border-(--c-line-strong) bg-(--c-surface) text-(--c-ink) transition-colors hover:border-(--c-faint) hover:bg-(--c-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--c-accent) disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label={`Mai multe stickere pentru ${item.code || item.name}`}
                          >
                            <Plus aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(item.id)}
                            className="ml-1 grid size-7 place-items-center rounded-full text-(--c-faint) transition-colors hover:bg-(--c-red-soft) hover:text-(--c-red) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--c-accent)"
                            aria-label={`Scoate ${item.code || item.name} din selecție`}
                          >
                            <X aria-hidden="true" className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 text-sm">
              <span aria-live="polite" className="px-2 font-medium text-(--c-muted)">
                <span className="font-semibold text-(--c-ink)">{items.length}</span>{" "}
                {items.length === 1 ? "piesă" : "piese"}
              </span>
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-(--c-line)" />
              <a
                href={printHref}
                rel="noopener"
                target="_blank"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium text-(--c-ink) transition-colors hover:bg-(--c-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--c-accent)"
              >
                <Printer aria-hidden="true" className="size-4 text-(--c-muted)" />
                Printează {stickerCount} {stickerCount === 1 ? "sticker" : "stickere"}
              </a>
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                aria-label={
                  expanded
                    ? "Restrânge lista cantităților"
                    : "Arată lista cantităților"
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium text-(--c-ink) transition-colors hover:bg-(--c-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--c-accent)"
              >
                <ListOrdered aria-hidden="true" className="size-4 text-(--c-muted)" />
                Cantități
                {expanded ? (
                  <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
                ) : (
                  <ChevronUp aria-hidden="true" className="size-4 shrink-0" />
                )}
              </button>
              <button
                type="button"
                onClick={clear}
                aria-label="Golește lista de stickere"
                title="Golește lista"
                className="ml-auto grid size-8 place-items-center rounded-lg text-(--c-muted) transition-colors hover:bg-(--c-hover) hover:text-(--c-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--c-accent)"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
