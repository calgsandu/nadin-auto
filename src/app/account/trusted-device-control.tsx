"use client";

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
      className={`button-secondary inline-flex items-center justify-center rounded-xl border border-[#e8e7e3] bg-white font-semibold text-[#6f6b63] hover:text-[#1b1a17] disabled:opacity-60 ${
        compact ? "size-8 text-[10px]" : "px-3 py-2 text-sm"
      }`}
    >
      {pending ? "…" : compact ? "2FA" : label}
    </button>
  );
}
