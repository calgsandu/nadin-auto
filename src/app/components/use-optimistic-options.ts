"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Lista venită de la server + ce s-a creat în dialogul-copil.
 *
 * `revalidatePath` din acțiune reîmprospătează pagina, dar prop-ul sosește DUPĂ
 * ce selectul a primit deja noua valoare — fără îmbinarea asta, rândul ar rămâne
 * o clipă gol, exact în secunda în care operatorul se uită la el.
 *
 * Când opțiunea ajunge și de la server, dublura cade singură (potrivire pe `id`).
 */
export function useOptimisticOptions<T extends { id: string }>(fromServer: readonly T[]) {
  const [added, setAdded] = useState<T[]>([]);

  const options = useMemo(
    () => [...fromServer, ...added.filter((one) => !fromServer.some((it) => it.id === one.id))],
    [fromServer, added],
  );

  const add = useCallback((one: T) => setAdded((current) => [...current, one]), []);

  return { options, add };
}
