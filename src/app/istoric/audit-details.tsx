"use client";

import { useState, useTransition } from "react";
import { loadAuditDetailsAction } from "./actions";

/**
 * „Vezi detalii" din jurnal: snapshot-ul JSON se cere abia la prima deschidere.
 * Lista îl aducea pentru toate cele 200 de rânduri (~9 MB, 7-17 s de transfer).
 */
export function AuditDetails({ id }: { id: string }) {
  const [json, setJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <details
      className="text-left"
      onToggle={(event) => {
        if (!event.currentTarget.open || json || pending) return;
        startTransition(async () => {
          try {
            const details = await loadAuditDetailsAction(id);
            setJson(JSON.stringify(details, null, 2));
          } catch {
            setError("Detaliile nu au putut fi încărcate.");
          }
        });
      }}
    >
      <summary className="cursor-pointer whitespace-nowrap text-xs font-semibold text-[#1b1a17] underline decoration-[#2e90fa] underline-offset-4">
        Vezi detalii
      </summary>
      <pre className="mt-2 max-h-72 max-w-xl overflow-auto rounded-md border border-[#e8e7e3] bg-[#fafaf9] p-2 text-left font-mono text-[11px] leading-relaxed text-[#33312c]">
        {error ?? json ?? "Se încarcă…"}
      </pre>
    </details>
  );
}
