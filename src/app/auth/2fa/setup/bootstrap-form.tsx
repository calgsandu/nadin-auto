"use client";

import { useActionState } from "react";
import { startInitialTwoFactorBootstrapAction } from "@/app/auth/2fa/actions";
import { initialTwoFactorFormState } from "@/app/auth/2fa/form-state";

export function BootstrapForm() {
  const [state, action, pending] = useActionState(
    startInitialTwoFactorBootstrapAction,
    initialTwoFactorFormState,
  );

  return (
    <form action={action} className="grid gap-4">
      <div className="rounded-xl border border-(--c-accent-line) bg-(--c-accent-soft) px-4 py-3 text-sm leading-6 text-(--c-accent-strong)">
        Acesta este primul cont de administrator. Poți configura primul
        Authenticator fără un cod emis de alt administrator.
      </div>
      {state.message ? (
        <div className="rounded-md border border-(--c-red-line) bg-(--c-red-soft) px-3 py-2 text-sm text-(--c-red)">
          {state.message}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-(--c-accent) text-sm font-semibold text-white hover:bg-(--c-accent-hover) disabled:opacity-60"
      >
        {pending ? "Se inițializează..." : "Inițializează 2FA"}
      </button>
    </form>
  );
}
