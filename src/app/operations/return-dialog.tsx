"use client";

import { FileText, Package, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  createReturnAction,
  type OperationActionState,
} from "@/app/operations/actions";
import {
  DrawerCard,
  DrawerField,
  DrawerTotal,
  OperationDrawer,
  handleEnterNavigation,
  useDrawerAction,
  drawerFormClassName,
  drawerInputClassName,
  drawerSecondaryButton,
} from "@/app/components/operation-drawer";
import { useDrawerDraft } from "@/app/components/use-drawer-draft";
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
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  function resetForm() {
    setSaleId("");
    setDocumentDate(today);
    setNotes("");
    setQuantities({});
  }
  // Returul ține TOT în state (vânzarea aleasă, data, cantitățile), deci ciorna
  // e chiar acest state.
  const draft = useDrawerDraft({
    kind: "return",
    lines: { saleId, documentDate, notes, quantities },
    setLines: (restored) => {
      setSaleId(restored.saleId);
      setDocumentDate(restored.documentDate);
      setNotes(restored.notes);
      setQuantities(restored.quantities);
    },
    reset: resetForm,
  });
  // Fără resetul automat al React: la eroare rămâne tot completat.
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(createReturnAction, initialState, () => {
    setOpen(false);
    resetForm();
    draft.clear();
  });

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
        onClick={() => setOpen(true)}
      >
        Adaugă retur
      </button>
      {open ? (
        <OperationDrawer
          title="Retur marfă"
          icon={Undo2}
          pending={pending}
          submitLabel="Salvează returul"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event)}>
                <input name="idempotencyKey" type="hidden" value={draft.token} />
                <DrawerCard icon={FileText} title="Detalii">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <Field label="Din vânzarea">
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
                            Vânzare #{s.number}, {s.dateLabel}, {s.warehouseName}
                            {s.partnerName ? `, ${s.partnerName}` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Data">
                      <input
                        className={inputClassName}
                        name="documentDate"
                        type="date"
                        value={documentDate}
                        onChange={(event) => setDocumentDate(event.currentTarget.value)}
                      />
                    </Field>
                  </div>
                </DrawerCard>

                {sale ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
                    <DrawerCard
                      lines
                      icon={Package}
                      title="Ce se returnează"
                      action={
                        // Clientul aduce adesea tot ce a luat: un click în loc de N cantități.
                        <button
                          className={secondaryButtonClassName}
                          type="button"
                          onClick={() =>
                            setQuantities(
                              Object.fromEntries(sale.lines.map((line) => [line.productId, String(line.quantity)])),
                            )
                          }
                        >
                          Returnează tot
                        </button>
                      }
                    >
                      <div className="grid gap-1.5">
                        {sale.lines.map((line) => {
                          const qty = Number(quantities[line.productId]) || 0;
                          return (
                            <div
                              key={line.productId}
                              className="grid gap-2 rounded-lg border border-[#ececef] bg-[#fafafa] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_7rem_8rem] md:items-center"
                            >
                              <input type="hidden" name="productId" value={line.productId} />
                              <div className="min-w-0">
                                <p className="font-medium text-[#18181b]">{line.label}</p>
                                <p className="mt-0.5 text-xs text-[#52525b]">
                                  vândut {line.quantity} × {money(line.unitPriceLei)} lei
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
                              <p className="text-right text-sm font-semibold tabular-nums text-[#18181b]">
                                {money(qty * line.unitPriceLei)} lei
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </DrawerCard>
                    <DrawerTotal total={money(totalLei)} vat={money(Math.round((totalLei / 6) * 100) / 100)} />
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-[#d4d4d8] bg-white px-4 py-8 text-center text-sm text-[#52525b]">
                    Alege vânzarea — apar produsele din ea.
                  </p>
                )}

                <Field label="Motivul returului">
                  <textarea
                    className={`${inputClassName} min-h-14 resize-y py-2`}
                    name="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.currentTarget.value)}
                  />
                </Field>
              </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}

// Aliasuri către shell-ul comun — stilurile drawerelor trăiesc într-un singur loc.
const Field = DrawerField;
const inputClassName = drawerInputClassName;
const primaryButtonClassName =
  "button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-[#18181b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#27272a]";
const secondaryButtonClassName = drawerSecondaryButton;
