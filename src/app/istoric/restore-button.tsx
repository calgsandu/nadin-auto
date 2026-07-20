"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { restoreDocumentAction, type RestoreActionState } from "@/app/istoric/actions";
import { ActionFeedback } from "@/app/components/action-feedback";

const initial: RestoreActionState = { ok: false, message: "" };

/** „Restaurează" pe intrările de ștergere din jurnal — recreează documentul. */
export function RestoreButton({ auditId, title }: { auditId: string; title: string }) {
  const [state, formAction] = useActionState(restoreDocumentAction, initial);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(e) => {
        if (!window.confirm(`Restaurezi documentul șters (${title})? Stocul va fi re-aplicat.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="auditId" value={auditId} />
      <SubmitButton />
      <ActionFeedback state={state} compact />
    </form>
  );
}

function SubmitButton() {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="button-secondary rounded-md border border-[#bbf7d0] px-3 py-1.5 text-xs font-semibold text-[#15803d] hover:bg-[#f0fdf4] disabled:opacity-60"
    >
      {status.pending ? "..." : "Restaurează"}
    </button>
  );
}
