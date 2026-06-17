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
            ? "button-secondary rounded-md border border-[#d8d2c6] px-3 py-1.5 text-xs font-semibold text-[#1d2521] hover:bg-[#f4f2ec]"
            : "button-primary rounded-md bg-[#202d27] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c3a33]"
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
            <aside className="motion-drawer-panel relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[#f8f6f1] shadow-xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#d8d2c6] bg-[#f8f6f1] px-6 py-5">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#68746d]">
                    Furnizori
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#1d2521]">
                    {partner ? "Editează furnizor" : "Adaugă furnizor"}
                  </h2>
                </div>
                <button
                  className="button-secondary rounded-md border border-[#d8d2c6] bg-white px-3 py-2 text-sm font-medium text-[#1d2521] hover:bg-[#f4f2ec]"
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
                        ? "border-[#9fbc84] bg-[#eef6e6] text-[#334719]"
                        : "border-[#d6a28b] bg-[#fff1eb] text-[#7a2f13]"
                    }`}
                  >
                    {state.message}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-3 border-t border-[#d8d2c6] pt-5">
                  <button
                    className="button-secondary rounded-md border border-[#d8d2c6] bg-white px-4 py-2.5 text-sm font-semibold text-[#1d2521] hover:bg-[#f4f2ec]"
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
  "field-control h-11 w-full rounded-md border border-[#d8d2c6] bg-white px-3 text-sm outline-none placeholder:text-[#8a918d] disabled:bg-[#eeeae1]";
