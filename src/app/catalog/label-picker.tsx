"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "nadin-label-selection";

function loadSelection(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSelection(selection: Set<string>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...selection]));
}

/**
 * Selectare multiplă de produse pentru stickere. Ascultă delegat pe checkbox-uri
 * cu `data-label-id` (randate server-side în rânduri). Selecția e ținută în
 * sessionStorage ca să supraviețuiască paginării și reload-ului.
 */
export function LabelPicker({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(() => loadSelection());

  // fără deps: după orice render (inclusiv schimbare de pagină cu rânduri noi)
  // rebifează checkbox-urile care sunt în selecție
  useEffect(() => {
    ref.current
      ?.querySelectorAll<HTMLInputElement>("input[data-label-id]")
      .forEach((box) => {
        box.checked = selected.has(box.dataset.labelId!);
      });
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    function onChange(event: Event) {
      const box = event.target as HTMLInputElement;
      const id = box.dataset?.labelId;
      if (!id) return;
      const checked = box.checked;
      setSelected((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
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
    setSelected(new Set());
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function print() {
    if (selected.size === 0) return;
    const ids = [...selected].join(",");
    window.open(`/print/labels?ids=${ids}&layout=grid`, "_blank", "noreferrer");
  }

  return (
    <div ref={ref}>
      {children}
      {/* portal la body: strămoșii cu transform (motion-page/gsap) ar face fixed relativ la ei */}
      {selected.size > 0
        ? createPortal(
            <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 print:hidden">
              <div className="flex items-center gap-4 rounded-full border border-[#e8e7e3] bg-white px-5 py-3 shadow-lg">
                <span className="text-sm font-semibold text-[#1b1a17]">
                  {selected.size} produse selectate
                </span>
                <button
                  type="button"
                  onClick={clear}
                  className="text-sm text-[#6f6b63] hover:text-[#1b1a17]"
                >
                  Deselectează
                </button>
                <button
                  type="button"
                  onClick={print}
                  className="rounded-full bg-[#1b1a17] px-4 py-2 text-sm font-semibold text-white hover:bg-[#33312c]"
                >
                  Printează stickere
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
