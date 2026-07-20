"use client";

import { useActionState } from "react";
import {
  confirmTwoFactorEnrollmentAction,
  regenerateTwoFactorEnrollmentAction,
} from "@/app/auth/2fa/actions";
import { initialTwoFactorFormState } from "@/app/auth/2fa/form-state";

export function SetupForm({
  credentialId,
  manualSecret,
  expiresAt,
}: {
  credentialId: string;
  manualSecret: string;
  expiresAt: string;
}) {
  const [state, action, pending] = useActionState(
    confirmTwoFactorEnrollmentAction,
    initialTwoFactorFormState,
  );

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-[#e8e7e3] bg-[#fafaf9] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6f6b63]">
          Cheie manuală
        </p>
        <code className="mt-2 block break-all font-mono text-sm font-semibold tracking-[0.12em] text-[#1b1a17]">
          {manualSecret}
        </code>
        <p className="mt-2 text-xs leading-5 text-[#98948b]">
          Folosește cheia numai dacă nu poți scana QR-ul. Configurarea expiră la {new Date(expiresAt).toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" })}.
        </p>
      </div>

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
            <span className="mt-0.5 block text-xs text-[#98948b]">Se aplică numai după autentificarea principală.</span>
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
          {pending ? "Se verifică..." : "Confirmă și continuă"}
        </button>
      </form>

      <form action={regenerateTwoFactorEnrollmentAction}>
        <button
          type="submit"
          className="w-full rounded-md border border-[#e8e7e3] bg-white px-4 py-2.5 text-sm font-semibold text-[#6f6b63] hover:bg-[#f6f6f4]"
        >
          Generează un QR nou
        </button>
      </form>
    </div>
  );
}
