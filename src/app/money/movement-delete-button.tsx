"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteMovementAction, type MoneyActionState } from "@/app/money/actions";
import { ActionFeedback } from "@/app/components/action-feedback";

const initialState: MoneyActionState = { ok: false, message: "" };

export function MovementDeleteButton({ movementId, label }: { movementId: string; label: string }) {
  const [state, formAction] = useActionState(deleteMovementAction, initialState);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(event) => {
        if (!window.confirm(`Ștergi mișcarea „${label}"? Soldul se recalculează.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="movementId" type="hidden" value={movementId} />
      <DeleteButton />
      <ActionFeedback state={state} />
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
