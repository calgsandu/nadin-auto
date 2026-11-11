"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  setReceiptDueDateAction,
  type DocumentActionState,
} from "@/app/operations/document-actions";
import { ActionFeedback } from "@/app/components/action-feedback";

const initialState: DocumentActionState = { ok: false, message: "" };

/** Scadența unei recepții, editabilă direct din listă. */
export function DueDateForm({
  documentId,
  dueDate,
}: {
  documentId: string;
  dueDate: string;
}) {
  const [state, formAction] = useActionState(setReceiptDueDateAction, initialState);

  return (
    <form action={formAction} className="grid justify-items-end gap-1">
      <input name="documentId" type="hidden" value={documentId} />
      <div className="flex items-center gap-2">
        <input
          className="h-9 rounded-md border border-[#e4e4e7] bg-white px-2 text-[13px] outline-none"
          defaultValue={dueDate}
          name="dueDate"
          type="date"
        />
        <SaveButton />
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}

function SaveButton() {
  const status = useFormStatus();
  return (
    <button
      className="button-secondary rounded-md border border-[#e4e4e7] px-2.5 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5] disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "..." : "Salvează"}
    </button>
  );
}
