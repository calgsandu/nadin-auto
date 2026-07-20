"use client";

import { useActionState } from "react";
import {
  initialTwoFactorFormState,
  verifyTwoFactorAction,
} from "@/app/auth/2fa/actions";

export function VerifyForm({ credentialId }: { credentialId: string }) {
  const [state, action, pending] = useActionState(
    verifyTwoFactorAction,
    initialTwoFactorFormState,
  );

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="credentialId" value={credentialId} />
      <label className="grid gap-1.5 text-sm font-medium text-[#33312c]">
        Codul din Authenticator
        <input
          className="h-12 rounded-md border border-[#e8e7e3] bg-white px-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-[#2e90fa] focus:ring-2 focus:ring-[#2e90fa]/30"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          required
          autoFocus
        />
      </label>
      <label className="flex items-start gap-3 text-sm text-[#33312c]">
        <input className="mt-0.5 size-4" type="checkbox" name="rememberDevice" />
        <span>
          Ține minte acest dispozitiv timp de 30 de zile
          <span className="mt-0.5 block text-xs text-[#98948b]">Nu activa opțiunea pe un dispozitiv comun.</span>
        </span>
      </label>
      {state.message ? (
        <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
          {state.message}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-[#1b1a17] text-sm font-semibold text-white hover:bg-[#33312c] disabled:opacity-60"
      >
        {pending ? "Se verifică..." : "Verifică și continuă"}
      </button>
    </form>
  );
}
