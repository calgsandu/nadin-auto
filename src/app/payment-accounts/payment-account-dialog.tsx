"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import {
  createPaymentAccountAction,
  type PaymentAccountActionState,
} from "@/app/payment-accounts/actions";
import { formatDateInputValue } from "@/lib/operations/date-input";
import { calculatePaymentTotals } from "@/lib/payment-accounts/totals";

type CustomerOption = {
  id: string;
  name: string;
  idno: string | null;
  address: string | null;
};

type WarehouseOption = { id: string; name: string };
type EditableLine = { id: number; quantity: string; price: string };

const initialState: PaymentAccountActionState = { ok: false, message: "" };
const inputClassName =
  "field-control h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm text-[#1b1a17] outline-none placeholder:text-[#98948b] focus:border-[#d97706] focus:ring-2 focus:ring-[#d97706]/25";

export function PaymentAccountDialog({
  customers,
  warehouses,
}: {
  customers: CustomerOption[];
  warehouses: WarehouseOption[];
}) {
  const [open, setOpen] = useState(false);
  const [newClient, setNewClient] = useState(false);
  const [lines, setLines] = useState<EditableLine[]>([{ id: 1, quantity: "", price: "" }]);
  const nextLineId = useRef(2);

  async function submit(previous: PaymentAccountActionState, formData: FormData) {
    const next = await createPaymentAccountAction(previous, formData);
    if (next.ok) {
      setOpen(false);
      setNewClient(false);
      setLines([{ id: 1, quantity: "", price: "" }]);
      nextLineId.current = 2;
    }
    return next;
  }

  const [state, formAction] = useActionState(submit, initialState);
  const today = useMemo(() => formatDateInputValue(new Date()), []);
  const defaultDueDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return formatDateInputValue(date);
  }, []);
  const defaultWarehouse =
    warehouses.find((warehouse) => warehouse.name === "Pavilion 110A")?.id ??
    warehouses[0]?.id ??
    "";
  const totals = calculatePaymentTotals(
    lines.map((line) => ({
      quantity: Number(line.quantity) || 0,
      unitPriceGross: Number(line.price) || 0,
    })),
    0.2,
    true,
  );

  function addLine() {
    const id = nextLineId.current++;
    setLines((current) => [...current, { id, quantity: "", price: "" }]);
  }

  function updateLine(id: number, field: "quantity" | "price", value: string) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  return (
    <>
      <button
        className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
        type="button"
        onClick={() => setOpen(true)}
      >
        Emite cont de plată
      </button>

      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
            <button
              aria-label="Închide contul de plată"
              className="absolute inset-0 cursor-default"
              type="button"
              onClick={() => setOpen(false)}
            />
            <aside className="motion-drawer-panel relative flex h-full w-full max-w-5xl flex-col overflow-y-auto bg-[#fafaf9] shadow-xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#a16207]">
                    Document comercial
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">Cont de plată nou</h2>
                  <p className="mt-1 text-sm text-[#6f6b63]">Nu modifică stocul până la predarea mărfii.</p>
                </div>
                <button
                  className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Închide
                </button>
              </div>

              <form action={formAction} className="grid gap-6 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Data emiterii">
                    <input className={inputClassName} defaultValue={today} name="issueDate" required type="date" />
                  </Field>
                  <Field label="Scadența">
                    <input className={inputClassName} defaultValue={defaultDueDate} name="dueDate" type="date" />
                  </Field>
                  <Field label="Marfa va fi predată din">
                    <select className={inputClassName} defaultValue={defaultWarehouse} name="warehouseId" required>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Client">
                    <div className="grid gap-2">
                      <div className="flex gap-2">
                        {newClient ? (
                          <input
                            autoFocus
                            className={inputClassName}
                            name="newCustomerName"
                            placeholder="nume client nou"
                            required
                          />
                        ) : (
                          <select className={inputClassName} defaultValue="" name="partnerId" required>
                            <option disabled value="">Alege clientul</option>
                            {customers.map((customer) => (
                              <option key={customer.id} value={customer.id}>
                                {customer.name}{!customer.idno || !customer.address ? " · date incomplete" : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          className="button-secondary shrink-0 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                          type="button"
                          onClick={() => setNewClient((current) => !current)}
                        >
                          {newClient ? "Alege din listă" : "Client nou"}
                        </button>
                      </div>
                      {newClient ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            className={inputClassName}
                            name="newCustomerIdno"
                            inputMode="numeric"
                            placeholder="IDNO / Cod fiscal"
                            required
                          />
                          <input
                            className={inputClassName}
                            name="newCustomerAddress"
                            placeholder="Adresa juridică"
                            required
                          />
                        </div>
                      ) : null}
                    </div>
                  </Field>
                </div>

                <section className="overflow-visible rounded-xl border border-[#e8e7e3] bg-white">
                  <div className="flex items-center justify-between gap-4 border-b border-[#e8e7e3] bg-[#f6f6f4] px-4 py-3">
                    <div>
                      <h3 className="font-semibold text-[#1b1a17]">Marfă</h3>
                      <p className="text-xs text-[#6f6b63]">Prețurile sunt finale, cu TVA inclus.</p>
                    </div>
                    <button
                      className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold"
                      type="button"
                      onClick={addLine}
                    >
                      <Plus className="size-4" aria-hidden="true" /> Adaugă produs
                    </button>
                  </div>
                  <div className="grid gap-3 p-3">
                    {lines.map((line, index) => {
                      const calculated = totals.lines[index];
                      return (
                        <div
                          key={line.id}
                          className="motion-line-item grid gap-3 rounded-md border border-[#efeeeb] p-3 md:grid-cols-[minmax(0,1fr)_6rem_9rem_12rem_2.75rem] md:items-start"
                        >
                          <div>
                            <p className="mb-1.5 text-xs font-semibold text-[#6f6b63]">Produs {index + 1}</p>
                            <ProductSearchCombobox
                              showHint={false}
                              onSelect={(product) => updateLine(line.id, "price", product.salePriceLei)}
                            />
                          </div>
                          <Field label="Cantitate">
                            <input
                              className={inputClassName}
                              min={1}
                              name="quantity"
                              required
                              type="number"
                              value={line.quantity}
                              onChange={(event) => updateLine(line.id, "quantity", event.currentTarget.value)}
                            />
                          </Field>
                          <Field label="Preț cu TVA">
                            <input
                              className={inputClassName}
                              min="0.01"
                              name="unitPriceGross"
                              required
                              step="0.01"
                              type="number"
                              value={line.price}
                              onChange={(event) => updateLine(line.id, "price", event.currentTarget.value)}
                            />
                          </Field>
                          <Field label="Linie">
                            <div className="flex h-11 flex-col justify-center rounded-md bg-[#f6f6f4] px-3 font-mono text-xs">
                              <span className="font-semibold">{money(calculated.gross)} lei</span>
                              <span className="text-[#6f6b63]">TVA {money(calculated.vat)} · net {money(calculated.net)}</span>
                            </div>
                          </Field>
                          <button
                            aria-label={`Șterge produsul ${index + 1}`}
                            className="button-danger mt-6 grid size-11 place-items-center rounded-md border border-[#fca5a5] text-[#b91c1c] disabled:opacity-35"
                            disabled={lines.length === 1}
                            type="button"
                            onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
                  <Field label="Mențiuni">
                    <textarea
                      className={`${inputClassName} min-h-24 resize-y py-3`}
                      name="notes"
                      placeholder="Termen de achitare, condiții de ridicare etc."
                    />
                  </Field>
                  <div className="rounded-xl border border-[#e8e7e3] bg-white p-4 text-sm">
                    <Summary label="Fără TVA" value={totals.net} />
                    <Summary label="TVA" value={totals.vat} />
                    <div className="mt-2 flex justify-between border-t border-[#e8e7e3] pt-3 text-base font-semibold">
                      <span>Total</span><span className="font-mono">{money(totals.gross)} lei</span>
                    </div>
                  </div>
                </div>

                {state.message && !state.ok ? (
                  <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
                    {state.message}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 border-t border-[#e8e7e3] pt-5">
                  <button className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-4 py-2.5 text-sm font-semibold" type="button" onClick={() => setOpen(false)}>
                    Anulează
                  </button>
                  <SubmitButton />
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
  return <label className="grid gap-1.5 text-xs font-semibold text-[#6f6b63]">{label}{children}</label>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between py-1"><span className="text-[#6f6b63]">{label}</span><span className="font-mono font-semibold">{money(value)} lei</span></div>;
}

function SubmitButton() {
  const status = useFormStatus();
  return (
    <button className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={status.pending} type="submit">
      {status.pending ? "Se emite..." : "Emite contul"}
    </button>
  );
}

const money = (value: number) => new Intl.NumberFormat("ro-MD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
