"use client";

import { useEffect, useRef } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

export type ActionToastState = {
  ok: boolean;
  message: string;
  /** Reușit, dar cu o rezervă (personal: cod emis care invalidează altul). */
  warning?: boolean;
};

/**
 * Notificările aplicației. Stau într-un singur loc, în layoutul rădăcină:
 * mesajele de eroare erau înainte în josul fiecărui formular, adică exact
 * unde nu se uită nimeni pe un dialog lung — trebuia derulat până jos ca să
 * afli de ce n-a mers salvarea.
 */
export function Toaster() {
  return (
    <SonnerToaster
      closeButton
      // Culorile pe tip vin de la sonner: cu clase proprii, teancul de
      // notificări suprapuse se picta ca un singur bloc colorat.
      richColors
      // Sus-dreapta: butonul de salvare al drawerelor e tot acolo, deci
      // răspunsul apare lângă acțiunea care l-a cerut.
      position="top-right"
      // Erorile nu dispar singure: operatorul trebuie să apuce să le citească,
      // chiar dacă se uita în altă parte când a apăsat „Salvează".
      toastOptions={{ duration: 5000 }}
    />
  );
}

/**
 * Transformă răspunsul unei acțiuni în notificare.
 *
 * Se declanșează la IDENTITATEA stării, nu la textul ei: două salvări la rând
 * care esuează la fel sunt două raspunsuri distincte, deci si a doua trebuie
 * sa scoata o notificare (altfel operatorul apasa din nou si nu vede nimic).
 */
export function useActionToast(
  state: ActionToastState,
  options?: {
    /** Dat = trimiterea n-a ajuns la server; notificarea primește „Reîncearcă". */
    onRetry?: () => void;
    /** false = succesul are deja alt semnal pe ecran (panou, parolă afișată). */
    success?: boolean;
  },
) {
  const seen = useRef(state);
  // Handlerul de reîncercare se schimbă la fiecare randare; notificarea
  // trebuie să-l apeleze pe cel curent, nu pe cel prins la montare.
  const retryRef = useRef(options?.onRetry);
  useEffect(() => {
    retryRef.current = options?.onRetry;
  });
  const withSuccess = options?.success ?? true;

  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (!state.message) return;

    if (state.warning) {
      toast.warning(state.message);
      return;
    }

    if (state.ok) {
      if (withSuccess) toast.success(state.message);
      return;
    }

    toast.error(state.message, {
      duration: Infinity,
      action: retryRef.current
        ? { label: "Reîncearcă", onClick: () => retryRef.current?.() }
        : undefined,
    });
  }, [state, withSuccess]);
}

export { toast };
