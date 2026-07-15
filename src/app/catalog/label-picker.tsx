"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Minus, Plus, X } from "lucide-react";
import {
  buildLabelPrintQuery,
  hydrateLabelSelection,
  MAX_LABEL_COUNT,
  MIN_LABEL_COUNT,
  parseLabelSelection,
  serializeLabelSelection,
  setLabelCount,
  toggleLabelSelection,
  type LabelSelectionItem,
} from "@/app/catalog/label-selection";

const STORAGE_KEY = "nadin-label-selection";

function loadSelection() {
  if (typeof window === "undefined") return [];
  return parseLabelSelection(sessionStorage.getItem(STORAGE_KEY));
}

function saveSelection(selection: LabelSelectionItem[]) {
  if (selection.length === 0) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, serializeLabelSelection(selection));
}

/**
 * Selectare multiplă de produse pentru stickere. Ascultă delegat pe checkbox-uri
 * cu `data-label-id` (randate server-side în rânduri). Selecția e ținută în
 * sessionStorage ca să supraviețuiască paginării și reload-ului.
 */
export function LabelPicker({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<LabelSelectionItem[]>(() =>
    loadSelection(),
  );
  const [expanded, setExpanded] = useState(true);

  // La schimbarea selecției sau paginii, rebifează rândurile vizibile și
  // completează metadatele selecțiilor salvate în formatul vechi.
  useEffect(() => {
    const boxes = ref.current?.querySelectorAll<HTMLInputElement>(
      "input[data-label-id]",
    );
    if (!boxes) return;

    const ids = new Set(selected.map((item) => item.id));
    const visible = Array.from(boxes, (box) => {
      box.checked = ids.has(box.dataset.labelId!);
      return {
        id: box.dataset.labelId!,
        code: box.dataset.labelCode ?? "",
        name: box.dataset.labelName ?? "",
        count: 1,
      };
    });

    setSelected((current) => {
      const hydrated = hydrateLabelSelection(current, visible);
      if (hydrated === current) return current;
      saveSelection(hydrated);
      return hydrated;
    });
  }, [children, selected]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    function onChange(event: Event) {
      const box = event.target as HTMLInputElement;
      const id = box.dataset?.labelId;
      if (!id) return;
      if (box.checked) setExpanded(true);

      setSelected((prev) => {
        const next = toggleLabelSelection(
          prev,
          {
            id,
            code: box.dataset.labelCode ?? "",
            name: box.dataset.labelName ?? "",
            count: 1,
          },
          box.checked,
        );
        saveSelection(next);
        return next;
      });
    }
    node.addEventListener("change", onChange);
    return () => node.removeEventListener("change", onChange);
  }, []);

  function clear() {
    ref.current
      ?.querySelectorAll<HTMLInputElement>("input[data-label-id]")
      .forEach((box) => (box.checked = false));
    setSelected([]);
    setExpanded(true);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function remove(id: string) {
    ref.current
      ?.querySelectorAll<HTMLInputElement>("input[data-label-id]")
      .forEach((box) => {
        if (box.dataset.labelId === id) box.checked = false;
      });
    setSelected((current) => {
      const next = current.filter((item) => item.id !== id);
      saveSelection(next);
      return next;
    });
  }

  function updateCount(id: string, count: number) {
    setSelected((current) => {
      const next = setLabelCount(current, id, count);
      saveSelection(next);
      return next;
    });
  }

  function print() {
    if (selected.length === 0) return;
    const query = buildLabelPrintQuery(selected);
    window.open(`/print/labels?${query.toString()}`, "_blank", "noreferrer");
  }

  const stickerCount = selected.reduce((total, item) => total + item.count, 0);

  return (
    <div ref={ref}>
      {children}
      {/* portal la body: strămoșii cu transform (motion-page/gsap) ar face fixed relativ la ei */}
      {selected.length > 0
        ? createPortal(
            <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 print:hidden sm:bottom-6 sm:px-4">
              <div className="w-full max-w-3xl overflow-hidden rounded-[1.35rem] border border-[#dedcd6] bg-white shadow-[0_18px_60px_rgba(27,26,23,0.20)]">
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
                    <div className="border-b border-[#e8e7e3] bg-[#fafaf9]">
                      <div className="flex items-center justify-between gap-4 border-b border-[#efeeeb] px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1b1a17]">
                            Cantități pentru print
                          </p>
                          <p className="mt-0.5 text-xs text-[#777269]">
                            {stickerCount} {stickerCount === 1 ? "sticker" : "stickere"} în total
                          </p>
                        </div>
                        <span className="rounded-full bg-[#f2b23e]/20 px-2.5 py-1 font-mono text-[11px] font-bold text-[#6f4a08]">
                          MAX. {MAX_LABEL_COUNT}/PRODUS
                        </span>
                      </div>

                      <div className="max-h-[min(50vh,24rem)] divide-y divide-[#efeeeb] overflow-y-auto overscroll-contain">
                        {selected.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-4"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs font-bold tracking-[0.02em] text-[#1b1a17]">
                                {item.code || item.id}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-[#777269]">
                                {item.name || "Produs selectat"}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateCount(item.id, item.count - 1)}
                                disabled={item.count <= MIN_LABEL_COUNT}
                                className="grid size-9 place-items-center rounded-full border border-[#dedcd6] bg-white text-[#1b1a17] transition-colors hover:border-[#b9b5ac] hover:bg-[#f3f2ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b1a17] disabled:cursor-not-allowed disabled:opacity-35"
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
                                className="h-9 w-12 rounded-lg border border-[#dedcd6] bg-white text-center font-mono text-sm font-bold text-[#1b1a17] [appearance:textfield] focus:border-[#1b1a17] focus:outline-none focus:ring-1 focus:ring-[#1b1a17] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                aria-label={`Număr stickere pentru ${item.code || item.name}`}
                              />
                              <button
                                type="button"
                                onClick={() => updateCount(item.id, item.count + 1)}
                                disabled={item.count >= MAX_LABEL_COUNT}
                                className="grid size-9 place-items-center rounded-full border border-[#dedcd6] bg-white text-[#1b1a17] transition-colors hover:border-[#b9b5ac] hover:bg-[#f3f2ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b1a17] disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label={`Mai multe stickere pentru ${item.code || item.name}`}
                              >
                                <Plus aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(item.id)}
                                className="ml-1 grid size-8 place-items-center rounded-full text-[#8d887f] transition-colors hover:bg-[#f4e6e4] hover:text-[#a53027] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b1a17]"
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

                <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    aria-expanded={expanded}
                    aria-label={
                      expanded
                        ? "Restrânge lista cantităților"
                        : "Arată lista cantităților"
                    }
                    className="flex min-w-0 items-center gap-2 rounded-full px-2 py-2 text-left text-sm font-semibold text-[#1b1a17] transition-colors hover:bg-[#f3f2ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b1a17]"
                  >
                    <span aria-live="polite">
                      {selected.length} {selected.length === 1 ? "produs selectat" : "produse selectate"}
                    </span>
                    {expanded ? (
                      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
                    ) : (
                      <ChevronUp aria-hidden="true" className="size-4 shrink-0" />
                    )}
                  </button>

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clear}
                      className="rounded-full px-3 py-2 text-sm text-[#6f6b63] transition-colors hover:bg-[#f3f2ef] hover:text-[#1b1a17] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b1a17]"
                    >
                      Deselectează
                    </button>
                    <button
                      type="button"
                      onClick={print}
                      className="rounded-full bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#33312c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b1a17] sm:px-5"
                    >
                      Printează stickere
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
