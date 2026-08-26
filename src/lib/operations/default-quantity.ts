/**
 * Cantitatea cu care pleacă un rând nou de operațiune (recepție, vânzare,
 * transfer, inventar, editare de document).
 *
 * Aproape fiecare rând e o singură bucată, deci câmpul gol însemna o tastare
 * în plus la fiecare piesă. Cine mișcă mai multe o schimbă peste valoare.
 */
export const DEFAULT_QUANTITY = "1";

/**
 * Cantitatea unui rând după alegerea produsului.
 *
 * Rândul nou pleacă gol la amândouă câmpurile: cu „1" pus din start, Enter din
 * căutare ateriza peste o cifră care era deja acolo și nu se știa dacă e aleasă
 * sau moștenită. Acum cantitatea apare odată cu produsul, iar ștergerea
 * produsului o ia înapoi.
 */
export function quantityAfterSelect(productId: string) {
  return productId ? DEFAULT_QUANTITY : "";
}
