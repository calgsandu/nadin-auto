"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  closeMonthAction,
  reopenMonthAction,
  type PeriodActionState,
} from "@/app/periods/actions";
import { ActionFeedback } from "@/app/components/action-feedback";

const initialState: PeriodActionState = { ok: false, message: "" };

export function CloseMonthForm({ month, label }: { month: string; label: string }) {
  const [state, formAction] = useActionState(closeMonthAction, initialState);

  return (
    <form
      action={formAction}
      className="grid gap-2 sm:flex sm:items-center"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Închizi ${label}? Documentele din luna asta nu se vor mai putea edita sau șterge.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="month" type="hidden" value={month} />
      <input
        className="field-control h-9 w-full rounded-md border border-[#e4e4e7] bg-white px-2.5 text-sm outline-none placeholder:text-[#71717a] sm:w-72"
        name="note"
        placeholder="Notă (ex. declarația TVA depusă)"
      />
      <SubmitButton label="Închide luna" />
      <ActionFeedback state={state} />
    </form>
  );
}

/** Redeschiderea cere motiv: luna închisă înseamnă declarație deja depusă. */
export function ReopenMonthForm({ month, label }: { month: string; label: string }) {
  const [state, formAction] = useActionState(reopenMonthAction, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="button-secondary rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
        onClick={() => setOpen(true)}
        type="button"
      >
        Redeschide
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="grid gap-2 sm:flex sm:items-center"
      onSubmit={(event) => {
        if (!window.confirm(`Redeschizi ${label}? Documentele redevin editabile.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="month" type="hidden" value={month} />
      <input
        autoFocus
        className="h-9 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-[13px] outline-none sm:w-64"
        name="reason"
        placeholder="De ce redeschizi luna?"
        required
      />
      <SubmitButton label="Confirmă" small />
      <ActionFeedback state={state} />
    </form>
  );
}

function SubmitButton({ label, small }: { label: string; small?: boolean }) {
  const status = useFormStatus();
  return (
    <button
      className={
        small
          ? "button-secondary rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5] disabled:opacity-60"
          : "button-primary rounded-md bg-[#18181b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#27272a] disabled:opacity-60"
      }
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "..." : label}
    </button>
  );
}
