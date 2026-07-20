"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  createInventoryAction,
  type OperationActionState,
} from "@/app/operations/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import { formatDateInputValue } from "@/lib/operations/date-input";
import type { WarehouseOption } from "@/app/operations/stock-document-dialog";

const initialState: OperationActionState = { ok: false, message: "" };

export function InventoryDialog({
  warehouses,
  defaultWarehouseId,
}: {
  warehouses: WarehouseOption[];
  defaultWarehouseId?: string;
}) {
  const [open, setOpen] = useState(false);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState([{ id: 1 }]);
  async function inventoryAction(previousState: OperationActionState, formData: FormData) {
    const nextState = await createInventoryAction(previousState, formData);
    if (nextState.ok) {
      setOpen(false);
      nextLineId.current = 2;
      setLines([{ id: 1 }]);
    }
    return nextState;
  }
  const [state, formAction] = useActionState(inventoryAction, initialState);
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  function addLine() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines((current) => [...current, { id }]);
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  return (
    <>
      <button className={primaryButtonClassName} type="button" onClick={() => setOpen(true)}>
        Corectează stocul
      </button>
      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
            <button
              aria-label="Închide inventarul"
              className="absolute inset-0 cursor-default"
              type="button"
              onClick={() => setOpen(false)}
            />
            <aside className="motion-drawer-panel relative flex h-full w-full max-w-7xl flex-col overflow-y-auto bg-[#fafaf9] shadow-xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#6f6b63]">
                    Document stoc
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">Inventar</h2>
                </div>
                <button className={secondaryButtonClassName} type="button" onClick={() => setOpen(false)}>
                  Închide
                </button>
              </div>
              <form action={formAction} className="grid gap-6 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Data inventarului">
                    <input className={inputClassName} defaultValue={today} name="documentDate" type="date" />
                  </Field>
                  <Field label="Depozitul inventariat">
                    <select
                      className={inputClassName}
                      defaultValue={defaultWarehouseId ?? warehouses[0]?.id ?? ""}
                      name="warehouseId"
                      required
                    >
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <section className="overflow-visible rounded-xl border border-[#e8e7e3] bg-white">
                  <div className="flex items-center justify-between gap-4 border-b border-[#e8e7e3] bg-[#f6f6f4] px-4 py-3">
                    <div>
                      <h3 className="font-semibold text-[#1b1a17]">Produse numărate</h3>
                      <p className="text-xs text-[#6f6b63]">
                        Scrie cantitatea NUMĂRATĂ fizic — sistemul calculează singur diferența și o ajustează.
                      </p>
                    </div>
                    <button className={secondaryButtonClassName} type="button" onClick={addLine}>
                      <Plus className="size-4" aria-hidden="true" /> Adaugă produs
                    </button>
                  </div>
                  <div className="grid gap-3 p-3">
                    {lines.map((line, index) => (
                      <div
                        key={line.id}
                        className="motion-line-item grid gap-3 rounded-md border border-[#efeeeb] bg-[#ffffff] p-3 md:grid-cols-[minmax(0,1fr)_10rem_2.75rem] md:items-start"
                      >
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-[#6f6b63]">Produs {index + 1}</p>
                          <ProductSearchCombobox showHint={false} />
                        </div>
                        <Field label="Numărat (buc)">
                          <input
                            className={inputClassName}
                            inputMode="numeric"
                            min={0}
                            name="countedQuantity"
                            required
                            type="number"
                          />
                        </Field>
                        <button
                          aria-label={`Șterge produsul ${index + 1}`}
                          className={dangerButtonClassName}
                          disabled={lines.length === 1}
                          type="button"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <Field label="Notițe">
                  <textarea
                    className={`${inputClassName} min-h-24 resize-y py-3`}
                    name="notes"
                    placeholder="cine a numărat, observații"
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
                  <SubmitButton label="Salvează inventarul" />
                </div>
              </form>
            </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
const dangerButtonClassName =
  "button-danger mt-6 grid size-11 place-items-center rounded-md border border-[#e8e7e3] bg-white text-[#991b1b] hover:border-[#dc2626] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-35";
