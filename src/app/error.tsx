"use client";

import { useEffect } from "react";
import {
  StatusLink,
  StatusScreen,
  statusPrimaryButton,
} from "@/app/components/status-screen";

/**
 * Orice eroare aruncată de o pagină ajunge aici, în loc de ecranul brut al
 * Next.js. `digest` e singurul indiciu pe care îl primește browserul în
 * producție (mesajul real rămâne în logurile serverului), deci se afișează:
 * fără el, un raport de eroare nu poate fi legat de nimic.
 */
export default function AppError({
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
      title="Ceva n-a mers"
      message="Pagina n-a putut fi încărcată. Încearcă din nou; dacă se repetă, trimite codul de mai jos."
      detail={error.digest}
      actions={
        <>
          <button className={statusPrimaryButton} type="button" onClick={reset}>
            Încearcă din nou
          </button>
          <StatusLink href="/" label="Înapoi la început" />
        </>
      }
    />
  );
}
