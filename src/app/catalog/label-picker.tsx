"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Selectare multiplă de produse pentru stickere. Ascultă delegat pe checkbox-uri
 * cu `data-label-id` (randate server-side în rânduri) și deschide pagina de
 * etichete cu toate id-urile selectate.
 */
export function LabelPicker({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function collect() {
    const boxes = ref.current?.querySelectorAll<HTMLInputElement>(
      "input[data-label-id]",
    );
    const next = new Set<string>();
    boxes?.forEach((box) => {
      if (box.checked) next.add(box.dataset.labelId!);
    });
    setSelected(next);
  }

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.addEventListener("change", collect);
    return () => node.removeEventListener("change", collect);
  }, []);

  function clear() {
    ref.current
      ?.querySelectorAll<HTMLInputElement>("input[data-label-id]")
      .forEach((box) => (box.checked = false));
    setSelected(new Set());
  }

  function print() {
    if (selected.size === 0) return;
    const ids = [...selected].join(",");
    window.open(`/print/labels?ids=${ids}&layout=grid`, "_blank", "noreferrer");
  }

  return (
    <div ref={ref}>
      {children}
      {selected.size > 0 ? (
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
        </div>
      ) : null}
    </div>
  );
}
