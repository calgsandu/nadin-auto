"use client";

import { useActionToast, type ActionToastState } from "@/app/components/action-toast";

/**
 * Răspunsul unei acțiuni de rând (bifă de recomandă, schimbare de casă,
 * ștergere). Nu mai randează nimic: textul mic de sub control se pierdea într-un
 * tabel lung, așa că răspunsul iese acum ca notificare, la fel ca la dialoguri.
 */
export function ActionFeedback({ state }: { state: ActionToastState }) {
  useActionToast(state);
  return null;
}
