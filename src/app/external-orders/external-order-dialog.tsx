"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  createExternalOrderAction,
  updateExternalOrderAction,
  type ExternalOrderActionState,
} from "@/app/external-orders/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";

export type ExternalOrderFormValue = {
  id: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  productCode: string;
  quantity: number;
  supplierId: string;
  supplierPriceLei: string;
  salePriceLei: string;
  offerValidUntil: string;
  notes: string;
};

export type SupplierOption = { id: string; name: string };

type ExternalOrderDialogProps = {
  order?: ExternalOrderFormValue;
  suppliers: SupplierOption[];
  triggerLabel: string;
  triggerKind?: "primary" | "row";
};

const initialState: ExternalOrderActionState = { ok: false, message: "" };

export function ExternalOrderDialog({
  order,
  suppliers,
  triggerLabel,
  triggerKind = "primary",
}: ExternalOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const action = order ? updateExternalOrderAction : createExternalOrderAction;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <>
      <button
        className={
          triggerKind === "row"
            ? "button-secondary rounded-md border border-[#e8e7e3] px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
            : "button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
        }
        type="button"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>

      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
            <button
              className="absolute inset-0 cursor-default"
              type="button"
              aria-label="Închide formularul"
              onClick={() => setOpen(false)}
            />
            <aside className="motion-drawer-panel relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[#fafaf9] shadow-xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#6f6b63]">
                    Comenzi la furnizori
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">
                    {order ? "Editează comanda" : "Comandă nouă"}
                  </h2>
                  <p className="mt-1 text-sm text-[#6f6b63]">
                    Piesa rămâne în catalogul furnizorului — nu se adaugă în stocul propriu.
                  </p>
                </div>
                <button
                  className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-medium text-[#1b1a17] hover:bg-[#f6f6f4]"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Închide
                </button>
              </div>

              <form action={formAction} className="grid gap-5 px-6 py-6">
                {order ? <input name="orderId" type="hidden" value={order.id} /> : null}

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Client">
                    <input
                      className={inputClassName}
                      name="customerName"
                      defaultValue={order?.customerName ?? ""}
                      placeholder="Numele clientului"
                      required
                    />
                  </Field>
                  <Field label="Telefon client">
                    <input
                      className={inputClassName}
                      name="customerPhone"
                      defaultValue={order?.customerPhone ?? ""}
                      inputMode="tel"
                      placeholder="ex. 060 123 456"
                    />
                  </Field>
                </div>

                <Field label="Piesa solicitată">
                  <input
                    className={inputClassName}
                    name="productName"
                    defaultValue={order?.productName ?? ""}
                    placeholder="ex. Far stânga Dacia Logan 2018"
                    required
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Cod piesă (opțional)">
                    <input
                      className={`${inputClassName} font-mono`}
                      name="productCode"
                      defaultValue={order?.productCode ?? ""}
                      placeholder="Codul din catalogul furnizorului"
                    />
                  </Field>
                  <Field label="Cantitate">
                    <input
                      className={inputClassName}
                      name="quantity"
                      defaultValue={order?.quantity ?? 1}
                      type="number"
                      min={1}
                      step={1}
                      required
                    />
                  </Field>
                </div>

                <Field label="Furnizor">
                  <select
                    className={inputClassName}
                    name="supplierId"
                    defaultValue={order?.supplierId ?? ""}
                  >
                    <option value="">— de stabilit —</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Preț achiziție / buc (lei)">
                    <input
                      className={inputClassName}
                      name="supplierPriceLei"
                      defaultValue={order?.supplierPriceLei ?? ""}
                      inputMode="decimal"
                      placeholder="Costul de la furnizor"
                    />
                  </Field>
                  <Field label="Preț vânzare / buc (lei)">
                    <input
                      className={inputClassName}
                      name="salePriceLei"
                      defaultValue={order?.salePriceLei ?? ""}
                      inputMode="decimal"
                      placeholder="Prețul pentru client"
                    />
                  </Field>
                </div>

                <Field label="Oferta valabilă până la">
                  <input
                    className={inputClassName}
                    name="offerValidUntil"
                    defaultValue={order?.offerValidUntil ?? ""}
                    type="date"
                  />
                </Field>

                <Field label="Note">
                  <textarea
                    className={`${inputClassName} min-h-24 resize-y py-3`}
                    name="notes"
                    defaultValue={order?.notes ?? ""}
                    placeholder="Termen de livrare, condiții, observații..."
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
                  <button
                    className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-4 py-2.5 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                    type="button"
                    onClick={() => setOpen(false)}
                  >
                    Anulează
                  </button>
                  <SubmitButton label={order ? "Salvează" : "Creează comanda"} />
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
  "field-control h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm outline-none placeholder:text-[#98948b] disabled:bg-[#f0efec]";
