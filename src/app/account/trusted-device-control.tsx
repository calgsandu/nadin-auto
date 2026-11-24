"use client";

import { MonitorX } from "lucide-react";
import { useFormStatus } from "react-dom";
import { forgetCurrentTrustedDeviceAction } from "@/app/auth/actions";

export function TrustedDeviceControl() {
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
      <ForgetDeviceButton />
    </form>
  );
}

function ForgetDeviceButton() {
  const { pending } = useFormStatus();
  const label = "Uită acest dispozitiv";

  return (
    <button
      type="submit"
      title={label}
      aria-label={label}
      disabled={pending}
      className="button-secondary inline-flex items-center justify-center gap-2 rounded-lg border border-(--c-line) bg-(--c-surface) px-3 py-2 text-sm font-semibold text-(--c-muted) hover:text-(--c-ink) disabled:opacity-60"
    >
      {pending ? "…" : <MonitorX className="size-4" aria-hidden="true" />}
      {label}
    </button>
  );
}
