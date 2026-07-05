"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createReturnAction,
  type OperationActionState,
} from "@/app/operations/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { formatDateInputValue } from "@/lib/operations/date-input";

export type ReturnableSale = {
  id: string;
  number: number;
  dateLabel: string;
  warehouseName: string;
  partnerName: string | null;
  lines: {
    productId: string;
    label: string;
    quantity: number;
    unitPriceLei: number;
  }[];
};

const initialState: OperationActionState = { ok: false, message: "" };

export function ReturnDialog({ sales }: { sales: ReturnableSale[] }) {
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  async function returnAction(previousState: OperationActionState, formData: FormData) {
    const nextState = await createReturnAction(previousState, formData);
    if (nextState.ok) {
      setOpen(false);
      setSaleId("");
      setQuantities({});
    }
    return nextState;
  }
  const [state, formAction] = useActionState(returnAction, initialState);
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  const sale = sales.find((s) => s.id === saleId) ?? null;
  const totalLei = sale
    ? sale.lines.reduce(
        (sum, line) => sum + (Number(quantities[line.productId]) || 0) * line.unitPriceLei,
        0,
      )
    : 0;
  const money = (v: number) =>
    new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(v);

  return (
    <>
      <button className={primaryButtonClassName} type="button" onClick={() => setOpen(true)}>
        Adaugă retur
      </button>
      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
            <button
              aria-label="Închide returul"
              className="absolute inset-0 cursor-default"
              type="button"
              onClick={() => setOpen(false)}
            />
            <aside className="motion-drawer-panel relative flex h-full w-full max-w-5xl flex-col overflow-y-auto bg-[#fafaf9] shadow-xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#6f6b63]">
                    Document stoc
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">Retur marfă</h2>
                </div>
                <button className={secondaryButtonClassName} type="button" onClick={() => setOpen(false)}>
                  Închide
                </button>
              </div>
              <form action={formAction} className="grid gap-6 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Data returului">
                    <input className={inputClassName} defaultValue={today} name="documentDate" type="date" />
                  </Field>
                  <Field label="Vânzarea din care se returnează">
                    <select
                      className={inputClassName}
                      name="saleDocumentId"
                      required
                      value={saleId}
                      onChange={(e) => {
                        setSaleId(e.currentTarget.value);
                        setQuantities({});
                      }}
                    >
                      <option value="">Alege vânzarea</option>
                      {sales.map((s) => (
                        <option key={s.id} value={s.id}>
                          Vânzare #{s.number} · {s.dateLabel} · {s.warehouseName}
                          {s.partnerName ? ` · ${s.partnerName}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {sale ? (
                  <section className="overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
                    <div className="border-b border-[#e8e7e3] bg-[#f6f6f4] px-4 py-3">
                      <h3 className="font-semibold text-[#1b1a17]">Produse vândute</h3>
                      <p className="text-xs text-[#6f6b63]">
                        Completează cantitatea returnată pentru fiecare produs (0 = nu se returnează).
                      </p>
                    </div>
                    <div className="grid gap-3 p-3">
                      {sale.lines.map((line) => {
                        const qty = Number(quantities[line.productId]) || 0;
                        return (
                          <div
                            key={line.productId}
                            className="grid gap-3 rounded-md border border-[#efeeeb] bg-[#ffffff] p-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_10rem] md:items-center"
                          >
                            <input type="hidden" name="productId" value={line.productId} />
                            <div>
                              <p className="font-medium text-[#1b1a17]">{line.label}</p>
                              <p className="mt-0.5 text-xs text-[#6f6b63]">
                                Vândut: {line.quantity} buc · {money(line.unitPriceLei)} lei/buc
                              </p>
                            </div>
                            <Field label="Retur (buc)">
                              <input
                                className={inputClassName}
                                inputMode="numeric"
                                min={0}
                                max={line.quantity}
                                name="quantity"
                                type="number"
                                value={quantities[line.productId] ?? "0"}
                                onChange={(e) => {
                                  const value = e.currentTarget.value;
                                  setQuantities((current) => ({
                                    ...current,
                                    [line.productId]: value,
                                  }));
                                }}
                              />
                            </Field>
                            <div className="text-sm text-[#6f6b63]">
                              <p className="text-xs font-semibold">Valoare retur</p>
                              <p className="font-mono font-semibold text-[#1b1a17]">
                                {money(qty * line.unitPriceLei)} lei
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between border-t border-[#efeeeb] bg-[#f6f6f4] px-4 py-3 text-sm">
                      <span className="font-semibold text-[#1b1a17]">Total retur</span>
                      <span className="font-mono font-bold text-[#1b1a17]">{money(totalLei)} lei</span>
                    </div>
                  </section>
                ) : (
                  <p className="rounded-md border border-[#efeeeb] bg-white px-4 py-6 text-center text-sm text-[#6f6b63]">
                    Alege mai întâi vânzarea — vei vedea produsele vândute în ziua respectivă.
                  </p>
                )}

                <Field label="Notițe">
                  <textarea
                    className={`${inputClassName} min-h-24 resize-y py-3`}
                    name="notes"
                    placeholder="motivul returului"
                  />
                </Field>

                {state.message ? (
                  <div
                    className={`rounded-md border px-3 py-2 text-sm ${
                      state.ok
                        ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
                        : "border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]"
                    }`}
                  >
                    {state.message}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5">
                  <button className={secondaryButtonClassName} type="button" onClick={() => setOpen(false)}>
                    Anulează
                  </button>
                  <SubmitButton label="Salvează returul" />
                </div>
              </form>
            </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#33312c]">
      {label}
      {children}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const status = useFormStatus();
  return (
    <button
      className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Se salvează..." : label}
    </button>
  );
}

const inputClassName =
  "field-control h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm outline-none placeholder:text-[#98948b]";
const primaryButtonClassName =
  "button-primary rounded-md bg-[#1b1a17] px-3 py-2 text-sm font-semibold text-white hover:bg-[#33312c]";
const secondaryButtonClassName =
  "button-secondary flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#fafaf9]";
