"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { PartnerKind } from "@/generated/prisma/enums";
import {
  createPartnerAction,
  updatePartnerAction,
  type PartnerActionState,
} from "@/app/partners/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";

export type PartnerFormValue = {
  id: string;
  name: string;
  kind: PartnerKind;
  phone: string;
  email: string;
  address: string;
  idno: string;
  vatCode: string;
  iban: string;
  bankName: string;
  bankCode: string;
  notes: string;
};

type PartnerFormDialogProps = {
  partner?: PartnerFormValue;
  triggerLabel: string;
  triggerKind?: "primary" | "row";
};

const initialState: PartnerActionState = { ok: false, message: "" };

const KIND_OPTIONS: { value: PartnerKind; label: string }[] = [
  { value: "SUPPLIER", label: "Furnizor" },
  { value: "CUSTOMER", label: "Client" },
  { value: "BOTH", label: "Furnizor și client" },
];

export function PartnerFormDialog({
  partner,
  triggerLabel,
  triggerKind = "primary",
}: PartnerFormDialogProps) {
  const [open, setOpen] = useState(false);
  const action = partner ? updatePartnerAction : createPartnerAction;
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
                    Parteneri
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">
                    {partner ? "Editează partener" : "Adaugă partener"}
                  </h2>
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
                {partner ? (
                  <input name="partnerId" type="hidden" value={partner.id} />
                ) : null}

                <Field label="Nume">
                  <input
                    className={inputClassName}
                    name="name"
                    defaultValue={partner?.name ?? ""}
                    placeholder="ex. Auto Parts SRL"
                    required
                  />
                </Field>

                <Field label="Tip partener">
                  <select
                    className={inputClassName}
                    name="kind"
                    defaultValue={partner?.kind ?? "SUPPLIER"}
                  >
                    {KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Telefon">
                  <input
                    className={inputClassName}
                    name="phone"
                    defaultValue={partner?.phone ?? ""}
                    inputMode="tel"
                    placeholder="ex. 0760 123 456"
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="E-mail">
                    <input
                      className={inputClassName}
                      name="email"
                      defaultValue={partner?.email ?? ""}
                      inputMode="email"
                      placeholder="ex. contabilitate@firma.md"
                      type="email"
                    />
                  </Field>

                  <Field label="IDNO / Cod fiscal">
                    <input
                      className={inputClassName}
                      name="idno"
                      defaultValue={partner?.idno ?? ""}
                      inputMode="numeric"
                      placeholder="ex. 1006600052073"
                    />
                  </Field>
                </div>

                <Field label="Adresa juridică">
                  <input
                    className={inputClassName}
                    name="address"
                    defaultValue={partner?.address ?? ""}
                    placeholder="mun. Chișinău, str. ..."
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Cod TVA">
                    <input
                      className={inputClassName}
                      name="vatCode"
                      defaultValue={partner?.vatCode ?? ""}
                      inputMode="numeric"
                      placeholder="opțional"
                    />
                  </Field>

                  <Field label="Cod bancar / BIC">
                    <input
                      className={inputClassName}
                      name="bankCode"
                      defaultValue={partner?.bankCode ?? ""}
                      placeholder="ex. MOBBMD22"
                    />
                  </Field>
                </div>

                <Field label="IBAN">
                  <input
                    className={`${inputClassName} font-mono`}
                    name="iban"
                    defaultValue={partner?.iban ?? ""}
                    placeholder="MD..."
                  />
                </Field>

                <Field label="Banca">
                  <input
                    className={inputClassName}
                    name="bankName"
                    defaultValue={partner?.bankName ?? ""}
                    placeholder="Denumirea băncii"
                  />
                </Field>

                <Field label="Note">
                  <textarea
                    className={`${inputClassName} min-h-24 resize-y py-3`}
                    name="notes"
                    defaultValue={partner?.notes ?? ""}
                    placeholder="Observații, condiții de livrare etc."
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
                  <SubmitButton label={partner ? "Salvează" : "Adaugă"} />
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
