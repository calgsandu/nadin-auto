"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  createReceiptAction,
  createSaleAction,
  createTransferAction,
  type OperationActionState,
} from "@/app/operations/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import { formatDateInputValue } from "@/lib/operations/date-input";

export type WarehouseOption = {
  id: string;
  name: string;
};

export type SupplierOption = {
  id: string;
  name: string;
};

type StockDocumentDialogProps = {
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
};

const initialState: OperationActionState = {
  ok: false,
  message: "",
};

export function StockDocumentDialog({ warehouses, suppliers }: StockDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createReceiptAction, initialState);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<{ id: number; qty: string; price: string }[]>([
    { id: 1, qty: "", price: "" },
  ]);
  const defaultWarehouse = warehouses[0]?.id ?? "";
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  function addLine() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines((current) => [...current, { id, qty: "", price: "" }]);
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function setLineField(id: number, field: "qty" | "price", value: string) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  const valoare = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const tvaTotal = Math.round((valoare / 6) * 100) / 100;
  const faraTva = Math.round((valoare - tvaTotal) * 100) / 100;
  const money = (v: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(v);

  return (
    <>
      <button
        className={primaryButtonClassName}
        type="button"
        onClick={() => setOpen(true)}
      >
        Adaugă recepție
      </button>

      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            aria-label="Închide documentul"
            className="absolute inset-0 cursor-default"
            type="button"
            onClick={() => setOpen(false)}
          />
          <aside className="motion-drawer-panel relative flex h-full w-full max-w-5xl flex-col overflow-y-auto bg-[#f8f6f1] shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#d8d2c6] bg-[#f8f6f1] px-6 py-5">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#68746d]">
                  Document stoc
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1d2521]">
                  Recepție marfă
                </h2>
              </div>
              <button
                className={secondaryButtonClassName}
                type="button"
                onClick={() => setOpen(false)}
              >
                Închide
              </button>
            </div>

            <form action={formAction} className="grid gap-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Data documentului">
                  <input
                    className={inputClassName}
                    defaultValue={today}
                    name="documentDate"
                    type="date"
                  />
                </Field>
                <Field label="Locație">
                  <select
                    className={inputClassName}
                    defaultValue={defaultWarehouse}
                    name="warehouseId"
                    required
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Furnizor">
                  <select
                    className={inputClassName}
                    disabled={suppliers.length === 0}
                    name="partnerId"
                  >
                    <option value="">
                      {suppliers.length > 0 ? "Alege furnizorul" : "Nu există furnizori"}
                    </option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <section className="overflow-visible rounded-lg border border-[#d8d2c6] bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#d8d2c6] bg-[#f4f2ec] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#1d2521]">Produse recepționate</h3>
                    <p className="text-xs text-[#68746d]">
                      Toate pozițiile vor fi salvate într-un singur document.
                    </p>
                  </div>
                  <button
                    className={secondaryButtonClassName}
                    type="button"
                    onClick={addLine}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Adaugă produs
                  </button>
                </div>

                <div className="grid gap-3 p-3">
                  {lines.map((line, index) => {
                    const lineVal = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    const lineTva = lineVal / 6;
                    const lineNet = lineVal - lineTva;
                    return (
                    <div
                      key={line.id}
                      className="motion-line-item grid gap-3 rounded-md border border-[#e7e2d8] bg-[#fbfaf7] p-3 md:grid-cols-[minmax(0,1fr)_5rem_8rem_12rem_2.75rem] md:items-start"
                    >
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-[#68746d]">
                          Produs {index + 1}
                        </p>
                        <ProductSearchCombobox
                          showHint={false}
                          onSelect={(p) => setLineField(line.id, "price", p.defaultCostLei)}
                        />
                      </div>
                      <Field label="Cantitate">
                        <input
                          className={inputClassName}
                          inputMode="numeric"
                          min={1}
                          name="quantity"
                          required
                          type="number"
                          value={line.qty}
                          onChange={(e) => setLineField(line.id, "qty", e.currentTarget.value)}
                        />
                      </Field>
                      <Field label="Cost lei / bucată">
                        <input
                          className={inputClassName}
                          inputMode="decimal"
                          min={0}
                          name="unitCostLei"
                          placeholder="auto"
                          step="0.01"
                          type="number"
                          value={line.price}
                          onChange={(e) => setLineField(line.id, "price", e.currentTarget.value)}
                        />
                      </Field>
                      <Field label="Valoare / TVA / fără TVA">
                        <div className="flex h-11 flex-col justify-center rounded-md border border-[#e7e2d8] bg-[#f4f2ec] px-3 font-mono text-xs leading-tight text-[#1d2521]">
                          <span className="font-semibold">{money(lineVal)} lei</span>
                          <span className="text-[#68746d]">TVA {money(lineTva)} · net {money(lineNet)}</span>
                        </div>
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
                    );
                  })}
                </div>
              </section>

              <div className="ml-auto w-full max-w-xs rounded-lg border border-[#d8d2c6] bg-white p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-[#68746d]">TVA plătit (÷6)</span>
                  <span className="font-mono font-semibold">{money(tvaTotal)} lei</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#68746d]">Fără TVA</span>
                  <span className="font-mono font-semibold">{money(faraTva)} lei</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-[#e7e2d8] pt-2 text-base">
                  <span className="font-semibold text-[#1d2521]">Total (cu TVA)</span>
                  <span className="font-mono font-bold text-[#1d2521]">{money(valoare)} lei</span>
                </div>
              </div>

              <Field label="Notițe">
                <textarea
                  className={`${inputClassName} min-h-24 resize-y py-3`}
                  name="notes"
                  placeholder="factură, transport, explicații"
                />
              </Field>

              {state.message ? (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    state.ok
                      ? "border-[#9fbc84] bg-[#eef6e6] text-[#334719]"
                      : "border-[#d6a28b] bg-[#fff1eb] text-[#7a2f13]"
                  }`}
                >
                  {state.message}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 border-t border-[#d8d2c6] pt-5">
                <button
                  className={`${secondaryButtonClassName} px-4 py-2.5`}
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Anulează
                </button>
                <SubmitButton label="Salvează recepția" />
              </div>
            </form>
          </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}

export function StockTransferDialog({ warehouses }: { warehouses: WarehouseOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createTransferAction, initialState);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState([{ id: 1 }]);
  const defaultSourceWarehouse = warehouses[0]?.id ?? "";
  const defaultDestinationWarehouse =
    warehouses.find((warehouse) => warehouse.id !== defaultSourceWarehouse)?.id ?? "";
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
      <button
        className={primaryButtonClassName}
        type="button"
        onClick={() => setOpen(true)}
      >
        Adaugă transfer
      </button>

      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            aria-label="Închide transferul"
            className="absolute inset-0 cursor-default"
            type="button"
            onClick={() => setOpen(false)}
          />
          <aside className="motion-drawer-panel relative flex h-full w-full max-w-5xl flex-col overflow-y-auto bg-[#f8f6f1] shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#d8d2c6] bg-[#f8f6f1] px-6 py-5">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#68746d]">
                  Document stoc
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1d2521]">
                  Transfer între locații
                </h2>
              </div>
              <button
                className={secondaryButtonClassName}
                type="button"
                onClick={() => setOpen(false)}
              >
                Închide
              </button>
            </div>

            <form action={formAction} className="grid gap-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Data transferului">
                  <input
                    className={inputClassName}
                    defaultValue={today}
                    name="documentDate"
                    type="date"
                  />
                </Field>
                <Field label="Din locația">
                  <select
                    className={inputClassName}
                    defaultValue={defaultSourceWarehouse}
                    name="sourceWarehouseId"
                    required
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="În locația">
                  <select
                    className={inputClassName}
                    defaultValue={defaultDestinationWarehouse}
                    name="destinationWarehouseId"
                    required
                  >
                    <option value="">Alege destinația</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <section className="overflow-visible rounded-lg border border-[#d8d2c6] bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#d8d2c6] bg-[#f4f2ec] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#1d2521]">Produse transferate</h3>
                    <p className="text-xs text-[#68746d]">
                      Toate pozițiile vor fi mutate în aceeași operațiune.
                    </p>
                  </div>
                  <button
                    className={secondaryButtonClassName}
                    type="button"
                    onClick={addLine}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Adaugă produs
                  </button>
                </div>

                <div className="grid gap-3 p-3">
                  {lines.map((line, index) => (
                    <div
                      key={line.id}
                      className="motion-line-item grid gap-3 rounded-md border border-[#e7e2d8] bg-[#fbfaf7] p-3 md:grid-cols-[minmax(0,1fr)_10rem_2.75rem] md:items-start"
                    >
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-[#68746d]">
                          Produs {index + 1}
                        </p>
                        <ProductSearchCombobox showHint={false} />
                      </div>
                      <Field label="Cantitate">
                        <input
                          className={inputClassName}
                          inputMode="numeric"
                          min={1}
                          name="quantity"
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
                  placeholder="motiv, solicitare, responsabil"
                />
              </Field>

              {state.message ? (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    state.ok
                      ? "border-[#9fbc84] bg-[#eef6e6] text-[#334719]"
                      : "border-[#d6a28b] bg-[#fff1eb] text-[#7a2f13]"
                  }`}
                >
                  {state.message}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 border-t border-[#d8d2c6] pt-5">
                <button
                  className={`${secondaryButtonClassName} px-4 py-2.5`}
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Anulează
                </button>
                <SubmitButton label="Salvează transferul" />
              </div>
            </form>
          </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}

export function StockSaleDialog({ warehouses }: { warehouses: WarehouseOption[] }) {
  const [open, setOpen] = useState(false);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<{ id: number; qty: string; price: string }[]>([
    { id: 1, qty: "", price: "" },
  ]);
  async function saleAction(previousState: OperationActionState, formData: FormData) {
    const nextState = await createSaleAction(previousState, formData);

    if (nextState.ok) {
      setOpen(false);
      nextLineId.current = 2;
      setLines([{ id: 1, qty: "", price: "" }]);
    }

    return nextState;
  }

  const [state, formAction] = useActionState(saleAction, initialState);
  const defaultWarehouse =
    warehouses.find((warehouse) => warehouse.name === "Pavilion 110A")?.id ??
    warehouses[0]?.id ??
    "";
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  function addLine() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines((current) => [...current, { id, qty: "", price: "" }]);
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function setLineField(id: number, field: "qty" | "price", value: string) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  // Prices are VAT-inclusive (gross). TVA = valoare ÷ 6; fără TVA = valoare − TVA.
  const valoare = lines.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0,
  );
  const tvaTotal = Math.round((valoare / 6) * 100) / 100;
  const faraTva = Math.round((valoare - tvaTotal) * 100) / 100;
  const money = (v: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(v);

  return (
    <>
      <button className={primaryButtonClassName} type="button" onClick={() => setOpen(true)}>
        Adaugă vânzare
      </button>
      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            aria-label="Închide vânzarea"
            className="absolute inset-0 cursor-default"
            type="button"
            onClick={() => setOpen(false)}
          />
          <aside className="motion-drawer-panel relative flex h-full w-full max-w-5xl flex-col overflow-y-auto bg-[#f8f6f1] shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#d8d2c6] bg-[#f8f6f1] px-6 py-5">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#68746d]">
                  Document stoc
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1d2521]">Vânzare marfă</h2>
              </div>
              <button className={secondaryButtonClassName} type="button" onClick={() => setOpen(false)}>
                Închide
              </button>
            </div>
            <form action={formAction} className="grid gap-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Data vânzării">
                  <input className={inputClassName} defaultValue={today} name="documentDate" type="date" />
                </Field>
                <Field label="Vândut din locația">
                  <select className={inputClassName} defaultValue={defaultWarehouse} name="warehouseId" required>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <section className="overflow-visible rounded-lg border border-[#d8d2c6] bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#d8d2c6] bg-[#f4f2ec] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#1d2521]">Produse vândute</h3>
                    <p className="text-xs text-[#68746d]">Vânzările din 110A intră automat în lista De adus.</p>
                  </div>
                  <button className={secondaryButtonClassName} type="button" onClick={addLine}>
                    <Plus className="size-4" aria-hidden="true" /> Adaugă produs
                  </button>
                </div>
                <div className="grid gap-3 p-3">
                  {lines.map((line, index) => {
                    const lineVal = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    const lineTva = lineVal / 6;
                    const lineNet = lineVal - lineTva;
                    return (
                    <div key={line.id} className="motion-line-item grid gap-3 rounded-md border border-[#e7e2d8] bg-[#fbfaf7] p-3 md:grid-cols-[minmax(0,1fr)_5rem_8rem_12rem_2.75rem] md:items-start">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-[#68746d]">Produs {index + 1}</p>
                        <ProductSearchCombobox
                          showHint={false}
                          onSelect={(p) => setLineField(line.id, "price", p.salePriceLei)}
                        />
                      </div>
                      <Field label="Cantitate">
                        <input
                          className={inputClassName}
                          inputMode="numeric"
                          min={1}
                          name="quantity"
                          required
                          type="number"
                          value={line.qty}
                          onChange={(e) => setLineField(line.id, "qty", e.currentTarget.value)}
                        />
                      </Field>
                      <Field label="Preț lei / bucată">
                        <input
                          className={inputClassName}
                          inputMode="decimal"
                          min={0}
                          name="unitPriceEuro"
                          placeholder="auto"
                          step="0.01"
                          type="number"
                          value={line.price}
                          onChange={(e) => setLineField(line.id, "price", e.currentTarget.value)}
                        />
                      </Field>
                      <Field label="Valoare / TVA / fără TVA">
                        <div className="flex h-11 flex-col justify-center rounded-md border border-[#e7e2d8] bg-[#f4f2ec] px-3 font-mono text-xs leading-tight text-[#1d2521]">
                          <span className="font-semibold">{money(lineVal)} lei</span>
                          <span className="text-[#68746d]">TVA {money(lineTva)} · net {money(lineNet)}</span>
                        </div>
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
                    );
                  })}
                </div>
              </section>

              <div className="ml-auto w-full max-w-xs rounded-lg border border-[#d8d2c6] bg-white p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-[#68746d]">TVA plătit (÷6)</span>
                  <span className="font-mono font-semibold">{money(tvaTotal)} lei</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#68746d]">Fără TVA</span>
                  <span className="font-mono font-semibold">{money(faraTva)} lei</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-[#e7e2d8] pt-2 text-base">
                  <span className="font-semibold text-[#1d2521]">Total (cu TVA)</span>
                  <span className="font-mono font-bold text-[#1d2521]">{money(valoare)} lei</span>
                </div>
              </div>

              <Field label="Notițe">
                <textarea className={`${inputClassName} min-h-24 resize-y py-3`} name="notes" placeholder="client, comandă, explicații" />
              </Field>
              {state.message ? (
                <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? "border-[#9fbc84] bg-[#eef6e6] text-[#334719]" : "border-[#d6a28b] bg-[#fff1eb] text-[#7a2f13]"}`}>
                  {state.message}
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-3 border-t border-[#d8d2c6] pt-5">
                <button className={secondaryButtonClassName} type="button" onClick={() => setOpen(false)}>Anulează</button>
                <SubmitButton label="Salvează vânzarea" />
              </div>
            </form>
          </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#2f3a34]">
      {label}
      {children}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const status = useFormStatus();

  return (
    <button
      className="button-primary rounded-md bg-[#202d27] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c3a33] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Se salvează..." : label}
    </button>
  );
}

const inputClassName =
  "field-control h-11 w-full rounded-md border border-[#d8d2c6] bg-white px-3 text-sm outline-none placeholder:text-[#8a918d]";
const primaryButtonClassName =
  "button-primary rounded-md bg-[#202d27] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2c3a33]";
const secondaryButtonClassName =
  "button-secondary flex items-center gap-2 rounded-md border border-[#d8d2c6] bg-white px-3 py-2 text-sm font-semibold text-[#1d2521] hover:bg-[#f8f6f1]";
const dangerButtonClassName =
  "button-danger mt-6 grid size-11 place-items-center rounded-md border border-[#d8d2c6] bg-white text-[#8b3d2c] hover:border-[#c95f47] hover:bg-[#fff1eb] disabled:cursor-not-allowed disabled:opacity-35";
