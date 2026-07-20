"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  deletePartnerAction,
  type PartnerActionState,
} from "@/app/partners/actions";
import { ActionFeedback } from "@/app/components/action-feedback";

const initialState: PartnerActionState = { ok: false, message: "" };

export function PartnerDeleteButton({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const [state, formAction] = useActionState(deletePartnerAction, initialState);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(event) => {
        if (!window.confirm(`Ștergi partenerul "${partnerName}"?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="partnerId" type="hidden" value={partnerId} />
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
