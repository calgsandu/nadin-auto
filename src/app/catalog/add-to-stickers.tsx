"use client";

import { useEffect, useState } from "react";
import { Check, Printer } from "lucide-react";
import { addLabelItems, type LabelAddition } from "@/app/catalog/label-selection";
import { updateStickers } from "@/app/catalog/sticker-store";

/**
 * Pune piesele în lista comună de stickere (bara de jos le printează). Același
 * buton peste tot: rândul de produs, fișa, recepția, inventarul.
 */
export function AddToStickersButton({
  items,
  className,
  label,
}: {
  items: LabelAddition[];
  className?: string;
  /** Implicit „Sticker" / „Stickere (N)" după câte bucăți se adaugă. */
  label?: string;
}) {
  const [added, setAdded] = useState(false);
  const total = items.reduce((sum, item) => sum + Math.max(item.count, 0), 0);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(timer);
  }, [added]);

  const text = label ?? (total > 1 ? `Stickere (${total})` : "Sticker");

  return (
    <button
      type="button"
      className={className}
      disabled={total === 0}
      onClick={() => {
        updateStickers((current) => addLabelItems(current, items));
        setAdded(true);
      }}
    >
      {added ? (
        <Check className="size-4 text-(--c-green)" aria-hidden="true" />
      ) : (
        <Printer className="size-4 text-(--c-muted-2)" aria-hidden="true" />
      )}
      <span aria-live="polite">{added ? "Adăugat la stickere" : text}</span>
    </button>
  );
}
