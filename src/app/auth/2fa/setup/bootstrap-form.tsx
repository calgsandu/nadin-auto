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
      <div className="rounded-xl border border-[#b2ddff] bg-[#eff8ff] px-4 py-3 text-sm leading-6 text-[#1d4ed8]">
        Acesta este primul cont de administrator. Poți configura primul
        Authenticator fără un cod emis de alt administrator.
      </div>
      {state.message ? (
        <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
          {state.message}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-[#18181b] text-sm font-semibold text-white hover:bg-[#3f3f46] disabled:opacity-60"
      >
        {pending ? "Se inițializează..." : "Inițializează 2FA"}
      </button>
    </form>
  );
}
