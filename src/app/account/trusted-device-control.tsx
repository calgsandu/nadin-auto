"use client";

import { MonitorX } from "lucide-react";
import { useFormStatus } from "react-dom";
import { forgetCurrentTrustedDeviceAction } from "@/app/auth/actions";

export function TrustedDeviceControl({ compact = false }: { compact?: boolean }) {
  return (
    <form
      action={forgetCurrentTrustedDeviceAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Uiți acest dispozitiv? La următoarea autentificare va fi cerut codul din Authenticator.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <ForgetDeviceButton compact={compact} />
    </form>
  );
}

function ForgetDeviceButton({ compact }: { compact: boolean }) {
  const { pending } = useFormStatus();
  const label = "Uită acest dispozitiv";

  return (
    <button
      type="submit"
      title={label}
      aria-label={label}
      disabled={pending}
      className={`button-secondary inline-flex items-center justify-center rounded-lg border border-[#e4e4e7] bg-white font-semibold text-[#52525b] hover:text-[#18181b] disabled:opacity-60 ${
        compact ? "size-8" : "gap-2 px-3 py-2 text-sm"
      }`}
    >
      {pending ? "…" : <MonitorX className="size-4" aria-hidden="true" />}
      {compact ? null : label}
    </button>
  );
}
