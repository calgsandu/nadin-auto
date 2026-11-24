"use client";

import { useState, useTransition } from "react";
import { describeAuditDetails, type AuditViewSection } from "@/lib/audit/view";
import { loadAuditDetailsAction } from "./actions";

/**
 * „Vezi detalii" din jurnal: snapshot-ul se cere abia la prima deschidere.
 * Lista îl aducea pentru toate cele 200 de rânduri (~9 MB, 7-17 s de transfer).
 */
export function AuditDetails({ id }: { id: string }) {
  const [sections, setSections] = useState<AuditViewSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <details
      className="text-left"
      onToggle={(event) => {
        if (!event.currentTarget.open || sections || pending) return;
        startTransition(async () => {
          try {
            const { details, productNames } = await loadAuditDetailsAction(id);
            setSections(describeAuditDetails(details, productNames));
          } catch {
            setError("Detaliile nu au putut fi încărcate.");
          }
        });
      }}
    >
      <summary className="cursor-pointer whitespace-nowrap text-right text-xs font-semibold text-(--c-ink) underline decoration-(--c-accent) underline-offset-4">
        Vezi detalii
      </summary>
      <div className="mt-2 max-h-80 w-[min(36rem,80vw)] overflow-auto rounded-md border border-(--c-line) bg-(--c-surface-2) px-3 py-2 text-xs text-(--c-ink-2)">
        {error ?? (sections ? <Sections sections={sections} /> : "Se încarcă…")}
      </div>
    </details>
  );
}

function Sections({ sections }: { sections: AuditViewSection[] }) {
  if (!sections.length) return <p>Fără alte detalii.</p>;
  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <section key={index}>
          {section.title ? (
            <h4 className="mb-1 font-semibold text-(--c-ink)">{section.title}</h4>
          ) : null}
          <dl className="divide-y divide-(--c-line-2)">
            {section.rows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-between gap-4 py-1">
                <dt className="min-w-0 text-(--c-ink)">{row.label}</dt>
                <dd className="shrink-0 text-right tabular-nums text-(--c-muted)">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
