"use client";

import { useActionState } from "react";
import { activateTwoFactorEnrollmentAction } from "@/app/auth/2fa/actions";
import { initialTwoFactorFormState } from "@/app/auth/2fa/form-state";

export function ActivationForm() {
  const [state, action, pending] = useActionState(
    activateTwoFactorEnrollmentAction,
    initialTwoFactorFormState,
  );

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5 text-sm font-medium text-(--c-ink-2)">
        Cod unic de activare
        <input
          className="h-12 rounded-md border border-(--c-line) bg-(--c-surface) px-3 text-center font-mono text-base uppercase tracking-[0.18em] outline-none focus:border-(--c-accent) focus:ring-2 focus:ring-(--c-accent)/30"
          name="activationCode"
          inputMode="text"
          autoComplete="one-time-code"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          maxLength={19}
          required
          autoFocus
        />
      </label>
      <p className="text-xs leading-5 text-(--c-muted-2)">
        Codul expiră în 15 minute și poate fi folosit o singură dată. Cere-l direct administratorului; nu îl trimite în același loc în care păstrezi parola.
      </p>
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
        {pending ? "Se verifică..." : "Continuă la configurarea 2FA"}
      </button>
    </form>
  );
}
