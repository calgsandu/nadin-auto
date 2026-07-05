"use client";

import { useState } from "react";
import { Download, FileText, History } from "lucide-react";
import Link from "next/link";
import { DrawerPortal } from "@/app/components/drawer-portal";

export type DocumentDetailsLine = {
  id: string;
  code: string | null;
  description: string;
  quantity: number;
  price: number | null;
};

export type DocumentDetailsValue = {
  id: string;
  typeLabel: string;
  number: number;
  date: string;
  warehouse: string;
  partnerLabel: string;
  partner: string | null;
  partnerPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalLei: number;
  lines: DocumentDetailsLine[];
  /** ADMIN/DIRECTOR: arată exporturile PDF/XLSX + linkul spre istoric. */
  canExport: boolean;
  /** COMPANY.vatPayer — rândul de TVA apare doar la plătitori. */
  showVat: boolean;
};

const money = new Intl.NumberFormat("ro-MD", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Buton „Detalii" → drawer cu tot conținutul operațiunii. */
export function DocumentDetailsButton({ details }: { details: DocumentDetailsValue }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary rounded-md border border-[#e8e7e3] px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
      >
        Detalii
      </button>
      {open ? <DetailsPanel details={details} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DetailsPanel({
  details,
  onClose,
}: {
  details: DocumentDetailsValue;
  onClose: () => void;
}) {
  const total = details.totalLei;
  const tva = Math.round((total / 6) * 100) / 100;

  return (
    <DrawerPortal>
      <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
        <button
          className="absolute inset-0 cursor-default"
          type="button"
          aria-label="Închide"
          onClick={onClose}
        />
        <aside className="motion-drawer-panel relative flex h-full w-full max-w-3xl flex-col overflow-y-auto bg-[#fafaf9] shadow-xl">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#6f6b63]">
                Detalii operațiune
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#1b1a17]">
                {details.typeLabel} #{details.number}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-medium text-[#1b1a17] hover:bg-[#f6f6f4]"
            >
              Închide
            </button>
          </div>

          <div className="grid gap-4 px-6 py-6">
            <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-[#e8e7e3] bg-white p-4 text-sm sm:grid-cols-2">
              <MetaItem label="Data documentului" value={details.date} />
              <MetaItem label="Depozit" value={details.warehouse} />
              <MetaItem
                label={details.partnerLabel}
                value={
                  details.partner
                    ? `${details.partner}${details.partnerPhone ? ` · ${details.partnerPhone}` : ""}`
                    : "Consumator final"
                }
              />
              <MetaItem label="Note" value={details.notes || "—"} />
              <MetaItem label="Creat în sistem" value={details.createdAt} />
              <MetaItem label="Ultima modificare" value={details.updatedAt} />
            </dl>

            <div className="overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
              <div className="border-b border-[#e8e7e3] bg-[#f6f6f4] px-4 py-2.5 text-sm font-semibold text-[#1b1a17]">
                Produse ({details.lines.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead className="border-b border-[#e8e7e3] bg-[#fafaf9] text-xs text-[#6f6b63]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Cod</th>
                      <th className="px-3 py-2 font-semibold">Produs</th>
                      <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                      <th className="px-3 py-2 text-right font-semibold">Preț (lei)</th>
                      <th className="px-3 py-2 text-right font-semibold">Valoare (lei)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.lines.map((line) => (
                      <tr key={line.id} className="border-t border-[#efeeeb]">
                        <td className="px-3 py-2 font-mono text-xs">{line.code ?? "—"}</td>
                        <td className="px-3 py-2">{line.description}</td>
                        <td className="px-3 py-2 text-right font-mono">{line.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {line.price != null ? money.format(line.price) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">
                          {line.price != null ? money.format(line.price * line.quantity) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-[#e8e7e3] bg-[#fafaf9] text-sm">
                    {details.showVat ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-[#6f6b63]">
                          TVA inclus (÷6)
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#6f6b63]">
                          {money.format(tva)}
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                        TOTAL (lei)
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {money.format(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {details.canExport ? (
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/export/document/${details.id}/pdf`}
                  className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3.5 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                >
                  <FileText className="size-4" aria-hidden="true" /> PDF
                </a>
                <a
                  href={`/api/export/invoice/${details.id}`}
                  className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3.5 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                >
                  <Download className="size-4" aria-hidden="true" /> Excel
                </a>
                <Link
                  href={`/?section=istoric&doc=${details.id}`}
                  className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3.5 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                >
                  <History className="size-4" aria-hidden="true" /> Istoric modificări
                </Link>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </DrawerPortal>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#98948b]">{label}</dt>
      <dd className="mt-0.5 text-[#1b1a17]">{value}</dd>
    </div>
  );
}
