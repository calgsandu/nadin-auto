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

const initialState = { ok: false, message: "" };

export function CashRegisterBadge({ value }: { value: CashRegisterStatus }) {
  const tone =
    value === true
      ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
      : value === false
        ? "border-[#fdba74] bg-[#fff7ed] text-[#9a3412]"
        : "border-[#d6d3d1] bg-[#fafaf9] text-[#57534a]";

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {cashRegisterLabel(value)}
    </span>
  );
}

export function CashRegisterControl({
  documentId,
  value,
}: {
  documentId: string;
  value: CashRegisterStatus;
}) {
  const [state, action] = useActionState(updateCashRegisteredAction, initialState);

  return (
    <form action={action} className="grid min-w-44 gap-1.5">
      <input name="id" type="hidden" value={documentId} />
      <div className="flex items-center justify-end gap-1.5">
        <select
          aria-label="Statut casă"
          className="h-8 rounded-md border border-[#e8e7e3] bg-white px-2 text-xs text-[#1b1a17]"
          defaultValue={cashRegisterFormValue(value)}
          name="cashRegistered"
        >
          <option value="yes">Bătut în casă</option>
          <option value="no">Nebătut în casă</option>
          <option value="unspecified">Nespecificat</option>
        </select>
        <SaveButton />
      </div>
      <ActionFeedback state={state} compact />
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="button-secondary h-8 rounded-md border border-[#e8e7e3] bg-white px-2.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4] disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "..." : "Salvează"}
    </button>
  );
}
