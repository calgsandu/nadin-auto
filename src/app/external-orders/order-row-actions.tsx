"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteExternalOrderAction,
  setExternalOrderStatusAction,
  type ExternalOrderActionState,
} from "@/app/external-orders/actions";
import { ActionFeedback } from "@/app/components/action-feedback";
import { NEXT_STATUS, STATUS_LABELS } from "@/lib/external-orders/status";
import type { ExternalOrderStatus } from "@/generated/prisma/enums";

const initialState: ExternalOrderActionState = { ok: false, message: "" };

/** Butoane de avans în flux: statusul următor + Anulează. */
export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: ExternalOrderStatus;
}) {
  const [state, formAction] = useActionState(setExternalOrderStatusAction, initialState);
  const nextStatuses = NEXT_STATUS[status];
  if (nextStatuses.length === 0) return null;

  return (
    <form action={formAction} className="grid justify-items-end gap-1">
      <input name="orderId" type="hidden" value={orderId} />
      <div className="flex flex-wrap justify-end gap-1.5">
        {nextStatuses.map((next) => (
          <StatusButton key={next} status={next} />
        ))}
      </div>
      <ActionFeedback state={state} compact />
    </form>
  );
}

function StatusButton({ status }: { status: ExternalOrderStatus }) {
  const pending = useFormStatus().pending;
  const cancel = status === "ANULAT";
  return (
    <button
      className={`button-secondary rounded-md border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
        cancel
          ? "border-[#fca5a5] text-[#b91c1c] hover:bg-[#fef2f2]"
          : "border-[#e8e7e3] text-[#1b1a17] hover:bg-[#f6f6f4]"
      }`}
      disabled={pending}
      name="status"
      value={status}
      type="submit"
    >
      {pending ? "..." : STATUS_LABELS[status]}
    </button>
  );
}

export function OrderDeleteButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: number;
}) {
  const [state, formAction] = useActionState(deleteExternalOrderAction, initialState);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(event) => {
        if (!window.confirm(`Ștergi comanda externă #${orderNumber}?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="orderId" type="hidden" value={orderId} />
      <DeleteButton />
      <ActionFeedback state={state} compact />
    </form>
  );
}

function DeleteButton() {
  const status = useFormStatus();
  return (
    <button
      className="button-secondary rounded-md border border-[#fca5a5] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "..." : "Șterge"}
    </button>
  );
}
