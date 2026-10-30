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
          active > 0 ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]" : "border-[#e4e4e7] bg-white text-[#3f3f46]"
        }`}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filtre
        {active > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-[#2563eb] px-1 text-xs font-semibold text-white">
            {active}
          </span>
        ) : null}
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div className={open ? "flex w-full flex-wrap items-center gap-2 sm:contents" : "hidden sm:contents"}>
        {children}
      </div>
    </>
  );
}
