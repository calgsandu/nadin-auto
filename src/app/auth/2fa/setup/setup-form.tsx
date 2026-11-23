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
      <div className="rounded-xl border border-[#e6e4df] bg-[#faf9f7] p-4">
        <p className="text-sm font-semibold text-[#57534e]">
          Cheie manuală
        </p>
        <code className="mt-2 block break-all font-mono text-sm font-semibold tracking-[0.12em] text-[#1a1917]">
          {manualSecret}
        </code>
        <p className="mt-2 text-xs leading-5 text-[#78716c]">
          Folosește cheia numai dacă nu poți scana QR-ul. Configurarea expiră la {new Date(expiresAt).toLocaleTimeString("ro-MD", { hour: "2-digit", minute: "2-digit" })}.
        </p>
      </div>

      <form action={action} className="grid gap-4">
        <input type="hidden" name="credentialId" value={credentialId} />
        <label className="grid gap-1.5 text-sm font-medium text-[#44403c]">
          Codul din Authenticator
          <input
            className="h-12 rounded-md border border-[#e6e4df] bg-white px-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/30"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
            autoFocus
          />
        </label>
        <label className="flex items-start gap-3 text-sm text-[#44403c]">
          <input className="mt-0.5 size-4" type="checkbox" name="rememberDevice" />
          <span>
            Ține minte acest dispozitiv timp de 30 de zile
            <span className="mt-0.5 block text-xs text-[#78716c]">Se aplică numai după autentificarea principală.</span>
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
          className="h-11 rounded-md bg-[#2563eb] text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
        >
          {pending ? "Se verifică..." : "Confirmă și continuă"}
        </button>
      </form>

      <form action={regenerateTwoFactorEnrollmentAction}>
        <button
          type="submit"
          className="w-full rounded-md border border-[#e6e4df] bg-white px-4 py-2.5 text-sm font-semibold text-[#57534e] hover:bg-[#f3f2ef]"
        >
          Generează un QR nou
        </button>
      </form>
    </div>
  );
}
