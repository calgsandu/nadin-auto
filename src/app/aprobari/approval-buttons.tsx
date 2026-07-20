"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  approvePendingOperationAction,
  rejectPendingOperationAction,
  type ApprovalActionState,
} from "@/app/aprobari/actions";
import { ActionFeedback } from "@/app/components/action-feedback";

const initial: ApprovalActionState = { ok: false, message: "" };

export function ApproveButton({ operationId }: { operationId: string }) {
  const [state, formAction] = useActionState(
    approvePendingOperationAction,
    initial,
  );

  return (
    <form action={formAction} className="grid justify-items-end gap-1.5">
      <input type="hidden" name="operationId" value={operationId} />
      <PendingAwareButton
        idleLabel="Aprobă și aplică"
        pendingLabel="Se aplică…"
        className="button-secondary rounded-md border border-[#bbf7d0] bg-white px-3 py-1.5 text-xs font-semibold text-[#15803d] hover:bg-[#f0fdf4] disabled:cursor-wait disabled:opacity-60"
      />
      <ActionFeedback state={state} compact />
    </form>
  );
}

export function RejectButton({ operationId }: { operationId: string }) {
  const [state, formAction] = useActionState(
    rejectPendingOperationAction,
    initial,
  );
  const [open, setOpen] = useState(false);

  if (!open && !state.message) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary rounded-md border border-[#fecaca] bg-white px-3 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2]"
      >
        Respinge
      </button>
    );
  }

  return (
    <form action={formAction} className="grid w-64 gap-1.5 text-left">
      <input type="hidden" name="operationId" value={operationId} />
      <label className="grid gap-1 text-xs font-semibold text-[#6f6b63]">
        Motivul respingerii
        <textarea
          name="reason"
          rows={2}
          required
          autoFocus
          placeholder="Ex.: cantitate sau client greșit"
          className="w-full rounded-md border border-[#e8e7e3] bg-white px-2 py-1.5 text-xs text-[#1b1a17] outline-none focus:border-[#2e90fa] focus:ring-2 focus:ring-[#2e90fa]/20"
        />
      </label>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#6f6b63] hover:bg-[#f6f6f4]"
        >
          Renunță
        </button>
        <PendingAwareButton
          idleLabel="Confirmă respingerea"
          pendingLabel="Se respinge…"
          className="rounded-md bg-[#b91c1c] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#991b1b] disabled:cursor-wait disabled:opacity-60"
        />
      </div>
      <ActionFeedback state={state} compact />
    </form>
  );
}

function PendingAwareButton({
  idleLabel,
  pendingLabel,
  className,
}: {
  idleLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} className={className}>
      {status.pending ? pendingLabel : idleLabel}
    </button>
  );
}
