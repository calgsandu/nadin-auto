/**
 * Marja de timp pentru tranzacțiile care umblă linie cu linie pe un document
 * (inventare, editări, ștergeri). Fiecare produs face câteva tururi spre Neon,
 * deci limita implicită Prisma de 5 s cade la documentele lungi.
 *
 * Plafonul real e `maxDuration` al paginii /crm (60 s pe Hobby), de unde
 * pornesc toate acțiunile: marja stă puțin sub el, ca documentul prea lung să
 * pice cu mesajul Prisma, nu cu un 504 mut. Pe Vercel Pro urcă amândouă la 300.
 *
 * Stocul se scrie acum pe loturi (stock-mutations.ts), deci marja e plasă de
 * siguranță, nu limita de zi cu zi. Ce a rămas per produs: `applyReceiptCost`
 * la editarea recepțiilor — de trecut pe loturi dacă acelea ajung la sute de
 * linii.
 */
export const DOCUMENT_TX_OPTIONS = { timeout: 55_000, maxWait: 15_000 } as const;
