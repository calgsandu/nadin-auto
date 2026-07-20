"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateSalePaymentMethodAction } from "@/app/operations/document-actions";
import { ActionFeedback } from "@/app/components/action-feedback";
import {
  salePaymentMethodFormValue,
  salePaymentMethodLabel,
  type SalePaymentMethodStatus,
} from "@/lib/operations/sale-payment-method";

const initialState = { ok: false, message: "" };

export function SalePaymentMethodBadge({
  value,
}: {
  value: SalePaymentMethodStatus;
}) {
  const tone =
    value === "CASH"
      ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
      : value === "CARD"
        ? "border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]"
        : "border-[#d6d3d1] bg-[#fafaf9] text-[#57534a]";

  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {salePaymentMethodLabel(value)}
    </span>
  );
}

export function SalePaymentMethodControl({
  documentId,
  value,
}: {
  documentId: string;
  value: SalePaymentMethodStatus;
}) {
  const [state, action] = useActionState(
    updateSalePaymentMethodAction,
    initialState,
  );

  return (
    <form action={action} className="grid min-w-44 gap-1.5">
      <input name="id" type="hidden" value={documentId} />
      <div className="flex items-center justify-end gap-1.5">
        <select
          aria-label="Metoda de plată"
          className="h-8 rounded-md border border-[#e8e7e3] bg-white px-2 text-xs text-[#1b1a17]"
          defaultValue={salePaymentMethodFormValue(value)}
          name="paymentMethod"
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
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
