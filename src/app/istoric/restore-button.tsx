"use client";

import { RotateCcw } from "lucide-react";
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
      <ActionFeedback state={state} />
    </form>
  );
}

function SubmitButton() {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-(--c-green-line) px-3 py-1.5 text-xs font-semibold text-(--c-green) hover:bg-(--c-green-soft) disabled:opacity-60"
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
      {status.pending ? "..." : "Restaurează"}
    </button>
  );
}
