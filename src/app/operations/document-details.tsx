"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileText, History } from "lucide-react";
import Link from "next/link";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { drawerPanelClassName } from "@/app/components/operation-drawer";
import {
  salePaymentMethodLabel,
  type SalePaymentMethodStatus,
} from "@/lib/operations/sale-payment-method";
import { CloseIconButton, IconLabel, rowIconButtonCls } from "@/app/components/icon-buttons";

export type DocumentDetailsLine = {
  id: string;
  code: string | null;
  description: string;
  /** Marca + model + ani (din fitmentul principal al produsului); null pe linii externe. */
  vehicle: string | null;
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
  isSale: boolean;
  paymentMethod: SalePaymentMethodStatus;
  lines: DocumentDetailsLine[];
  /** Seria/numărul facturii externe (1C: „Сер. № накладной"). */
  externalNumber: string | null;
  /** Discount aplicat pe document, în procente. */
  discountPercent: number | null;
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
        title="Detalii"
        className={rowIconButtonCls}
      >
        <Eye aria-hidden="true" />
        <IconLabel>Detalii</IconLabel>
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <DrawerPortal>
      <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
        <button
          className="absolute inset-0 cursor-default"
          type="button"
          aria-label="Închide"
          onClick={onClose}
        />
        <aside className={drawerPanelClassName}>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#e4e4e7] bg-[#fafafa] px-5 py-3">
            <div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#18181b]">
                {details.typeLabel} #{details.number}
              </h2>
            </div>
            <CloseIconButton onClick={onClose} />
          </div>

          <div className="grid gap-4 px-5 py-4">
            <dl className="grid gap-x-6 gap-y-1.5 rounded-lg border border-[#e4e4e7] bg-white p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <MetaItem label="Data documentului" value={details.date} />
              <MetaItem label="Depozit" value={details.warehouse} />
              <MetaItem
                label={details.partnerLabel}
                value={
                  details.partner
                    ? `${details.partner}${details.partnerPhone ? `, ${details.partnerPhone}` : ""}`
                    : "Consumator final"
                }
              />
              <MetaItem label="Note" value={details.notes || "—"} />
              {details.externalNumber ? (
                <MetaItem label="Serie / nr. factură" value={details.externalNumber} />
              ) : null}
              {details.discountPercent ? (
                <MetaItem label="Discount" value={`${details.discountPercent}%`} />
              ) : null}
              {details.isSale ? (
                <MetaItem
                  label="Metoda de plată"
                  value={salePaymentMethodLabel(details.paymentMethod)}
                />
              ) : null}
              <MetaItem label="Creat în sistem" value={details.createdAt} />
              <MetaItem label="Ultima modificare" value={details.updatedAt} />
            </dl>

            <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
              <div className="border-b border-[#e4e4e7] bg-[#f4f4f5] px-3.5 py-2 text-sm font-semibold text-[#18181b]">
                Produse ({details.lines.length})
              </div>
              <div className="overflow-x-auto">
                <table className="crm-table w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead className="border-b border-[#e4e4e7] bg-[#fafafa] text-xs text-[#52525b]">
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
                      <tr key={line.id} className="border-t border-[#f0f0f2]">
                        <td className="px-3 py-2 font-mono text-xs">{line.code ?? "—"}</td>
                        <td className="px-3 py-2">
                          {line.description}
                          {line.vehicle ? (
                            <span className="mt-0.5 block text-xs text-[#52525b]">
                              {line.vehicle}
                            </span>
                          ) : null}
                        </td>
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
                  <tfoot className="border-t border-[#e4e4e7] bg-[#fafafa] text-sm">
                    {details.showVat ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-[#52525b]">
                          TVA inclus (÷6)
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#52525b]">
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
                  className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e4e4e7] bg-white px-3.5 py-2 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
                >
                  <FileText className="size-4" aria-hidden="true" /> PDF intern
                </a>
                <a
                  href={`/api/export/invoice/${details.id}`}
                  className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e4e4e7] bg-white px-3.5 py-2 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
                >
                  <Download className="size-4" aria-hidden="true" /> Excel intern
                </a>
                <Link
                  href={`/crm/istoric?doc=${details.id}`}
                  className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e4e4e7] bg-white px-3.5 py-2 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
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
      <dt className="text-sm text-[#71717a]">{label}</dt>
      <dd className="mt-0.5 text-[#18181b]">{value}</dd>
    </div>
  );
}
