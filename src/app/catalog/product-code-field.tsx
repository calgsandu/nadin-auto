"use client";

import { useEffect, useRef, useState } from "react";

type Duplicate = { id: string; label: string };

/**
 * Câmpul de cod din fișa produsului. Cât scrii, verifică dacă alt produs are
 * deja codul ăsta (cod sau cod alternativ) și te avertizează pe loc — dublurile
 * din catalog se nasc exact aici. Nu blochează: uneori două piese au același cod.
 */
export function ProductCodeField({
  className,
  defaultValue,
  productId,
}: {
  className: string;
  defaultValue: string;
  /** Produsul editat — el însuși nu e dublură. */
  productId?: string;
}) {
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function check(value: string) {
    window.clearTimeout(timer.current);
    const code = value.trim();
    if (code.length < 3) {
      setDuplicate(null);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ code });
        if (productId) params.set("exclude", productId);
        const response = await fetch(`/api/products/search?${params}`);
        if (!response.ok) return;
        const data = (await response.json()) as { duplicate: Duplicate | null };
        setDuplicate(data.duplicate);
      } catch {
        // Fără rețea: avertismentul lipsește, salvarea merge oricum.
      }
    }, 400);
  }

  return (
    <>
      <input
        className={className}
        name="externalCode"
        defaultValue={defaultValue}
        placeholder="ex. P12013 1"
        onChange={(event) => check(event.currentTarget.value)}
      />
      {duplicate ? (
        <span className="text-xs font-medium text-[#b45309]">Codul există deja: {duplicate.label}</span>
      ) : null}
    </>
  );
}
