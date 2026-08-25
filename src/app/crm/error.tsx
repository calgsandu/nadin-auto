"use client";

import { useEffect } from "react";
import {
  StatusLink,
  StatusScreen,
  statusPrimaryButton,
} from "@/app/components/status-screen";

/** Eroarea unei secțiuni CRM: sidebarul și tab-urile rămân pe ecran. */
export default function CrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      title="Secțiunea nu s-a încărcat"
      message="Datele n-au putut fi citite. Încearcă din nou; dacă se repetă, trimite codul de mai jos."
      detail={error.digest}
      actions={
        <>
          <button className={statusPrimaryButton} type="button" onClick={reset}>
            Încearcă din nou
          </button>
          <StatusLink href="/crm" label="Panoul principal" />
        </>
      }
    />
  );
}
