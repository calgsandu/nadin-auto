"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * Pe telefon filtrele ocupau un ecran întreg înainte de primul rând din tabel.
 * Aici stau strânse sub un buton „Filtre" (cu câte sunt active); de la `sm` în
 * sus se văd ca înainte, pe rând. Ascunse, câmpurile rămân în formular, deci
 * „Aplică" le trimite oricum.
 */
export function MobileFilters({ active = 0, children }: { active?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium sm:hidden ${
          active > 0 ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]" : "border-[#e6e4df] bg-white text-[#44403c]"
        }`}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filtre
        {active > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-[#2563eb] px-1 text-xs font-semibold text-white">
            {active}
          </span>
        ) : null}
        <ChevronDown className={`size-4 transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div
        className={`grid w-full transition-[grid-template-rows,opacity,visibility] duration-200 ease-out sm:contents sm:visible sm:opacity-100 ${
          open
            ? "visible grid-rows-[1fr] opacity-100"
            : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="flex min-h-0 flex-wrap items-center gap-2 overflow-hidden sm:contents">{children}</div>
      </div>
    </>
  );
}
