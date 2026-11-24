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

const initialState = { ok: false, message: "", version: 0 };

function salePaymentMethodTone(value: SalePaymentMethodStatus) {
  return value === "CASH"
    ? "border-(--c-green-line) bg-(--c-green-soft) text-(--c-green)"
    : value === "CARD"
      ? "border-(--c-accent-line) bg-(--c-accent-soft) text-(--c-accent-strong)"
      : value === "CREDIT"
        ? "border-(--c-red-line) bg-(--c-red-soft) text-(--c-red)"
        : value === "TRANSFER"
          ? "border-(--c-amber-line) bg-(--c-amber-soft) text-(--c-amber)"
          : "border-(--c-line-strong) bg-(--c-surface-2) text-(--c-muted)";
}

export function SalePaymentMethodBadge({
  value,
}: {
  value: SalePaymentMethodStatus;
}) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${salePaymentMethodTone(value)}`}>
      {salePaymentMethodLabel(value)}
    </span>
  );
}

/** Metoda de plată editabilă din tabel — o listă colorată, salvată la alegere. */
export function SalePaymentMethodControl({
  documentId,
  value,
}: {
  documentId: string;
  value: SalePaymentMethodStatus;
}) {
  const [state, action] = useActionState(
    async (previous: typeof initialState, formData: FormData) => ({
      ...(await updateSalePaymentMethodAction(previous, formData)),
      version: previous.version + 1,
    }),
    initialState,
  );

  return (
    <form action={action}>
      <input name="id" type="hidden" value={documentId} />
      {/* Remontată după fiecare răspuns: la eșec lista revine la valoarea salvată. */}
      <SalePaymentMethodSelect key={state.version} value={value} />
      <ActionFeedback state={state} />
    </form>
  );
}

function SalePaymentMethodSelect({ value }: { value: SalePaymentMethodStatus }) {
  const { pending } = useFormStatus();
  return (
    <select
      aria-label="Metoda de plată"
      className={`inline-select h-7 rounded-md border pl-2.5 pr-7 text-xs font-semibold disabled:opacity-60 ${salePaymentMethodTone(value)}`}
      defaultValue={salePaymentMethodFormValue(value)}
      disabled={pending}
      name="paymentMethod"
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      <option value="cash">Cash</option>
      <option value="card">Card</option>
      <option value="credit">Pe datorie</option>
      <option value="transfer">Transfer bancar</option>
      <option value="unspecified">Nespecificat</option>
    </select>
  );
}
