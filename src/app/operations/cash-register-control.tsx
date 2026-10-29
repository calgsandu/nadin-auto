"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCashRegisteredAction } from "@/app/operations/document-actions";
import { ActionFeedback } from "@/app/components/action-feedback";
import {
  cashRegisterFormValue,
  cashRegisterLabel,
  type CashRegisterStatus,
} from "@/lib/operations/cash-register";

const initialState = { ok: false, message: "", version: 0 };

function cashRegisterTone(value: CashRegisterStatus) {
  return value === true
    ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
    : value === false
      ? "border-[#fdba74] bg-[#fff7ed] text-[#9a3412]"
      : "border-[#d6d3d1] bg-[#fafaf9] text-[#57534a]";
}

export function CashRegisterBadge({ value }: { value: CashRegisterStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${cashRegisterTone(value)}`}>
      {cashRegisterLabel(value)}
    </span>
  );
}

/**
 * Statutul de casă editabil direct din tabel: o singură listă colorată ca
 * eticheta, salvată la alegere. Înainte erau trei controale stivuite (etichetă,
 * listă, „Salvează") care dublau înălțimea fiecărui rând.
 */
export function CashRegisterControl({
  documentId,
  value,
}: {
  documentId: string;
  value: CashRegisterStatus;
}) {
  const [state, action] = useActionState(
    async (previous: typeof initialState, formData: FormData) => ({
      ...(await updateCashRegisteredAction(previous, formData)),
      version: previous.version + 1,
    }),
    initialState,
  );

  return (
    <form action={action}>
      <input name="id" type="hidden" value={documentId} />
      {/* Remontată după fiecare răspuns: la eșec lista revine la valoarea salvată. */}
      <CashRegisterSelect key={state.version} value={value} />
      <ActionFeedback state={state} />
    </form>
  );
}

function CashRegisterSelect({ value }: { value: CashRegisterStatus }) {
  const { pending } = useFormStatus();
  return (
    <select
      aria-label="Statut casă"
      className={`inline-select h-7 rounded-full border pl-2.5 pr-7 text-xs font-semibold disabled:opacity-60 ${cashRegisterTone(value)}`}
      defaultValue={cashRegisterFormValue(value)}
      disabled={pending}
      name="cashRegistered"
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      <option value="yes">Bătut în casă</option>
      <option value="no">Nebătut în casă</option>
      <option value="unspecified">Nespecificat</option>
    </select>
  );
}
