"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  createReturnAction,
  type OperationActionState,
} from "@/app/operations/actions";
import {
  DrawerField,
  DrawerSubmit,
  OperationDrawer,
  handleEnterNavigation,
  drawerFormClassName,
  drawerInputClassName,
  drawerSecondaryButton,
} from "@/app/components/operation-drawer";
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
  const today = useMemo(() => formatDateInputValue(new Date()), []);
  const [open, setOpen] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [documentDate, setDocumentDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  async function returnAction(previousState: OperationActionState, formData: FormData) {
    const nextState = await createReturnAction(previousState, formData);
    setShowFeedback(true);
    if (nextState.ok) {
      setOpen(false);
      setSaleId("");
      setDocumentDate(today);
      setNotes("");
      setQuantities({});
    } else {
      // React resetează DOM-ul formularului după o server action. Un obiect nou
      // forțează rerandarea și reaplică valorile controlate după eroare.
      setQuantities((current) => ({ ...current }));
    }
    return nextState;
  }
  const [state, formAction] = useActionState(returnAction, initialState);

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
      <button
        className={primaryButtonClassName}
        type="button"
        onClick={() => {
          setShowFeedback(false);
          setOpen(true);
        }}
      >
        Adaugă retur
      </button>
      {open ? (
        <OperationDrawer
          eyebrow="Document stoc"
          title="Retur marfă"
          onClose={() => setOpen(false)}
        >
          <form action={formAction} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Data returului">
                    <input
                      className={inputClassName}
                      name="documentDate"
                      type="date"
                      value={documentDate}
                      onChange={(event) => setDocumentDate(event.currentTarget.value)}
                    />
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
                  <section data-drawer-lines className="overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
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
                    value={notes}
                    onChange={(event) => setNotes(event.currentTarget.value)}
                  />
                </Field>

                {showFeedback && state.message ? (
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
        </OperationDrawer>
      ) : null}
    </>
  );
}

// Aliasuri către shell-ul comun — stilurile drawerelor trăiesc într-un singur loc.
const Field = DrawerField;
const SubmitButton = DrawerSubmit;
const inputClassName = drawerInputClassName;
const primaryButtonClassName =
  "button-primary rounded-md bg-[#1b1a17] px-3 py-2 text-sm font-semibold text-white hover:bg-[#33312c]";
const secondaryButtonClassName = drawerSecondaryButton;
