/**
 * Marja de timp pentru tranzacțiile care umblă linie cu linie pe un document
 * (inventare, editări, ștergeri). Fiecare produs face câteva tururi spre Neon,
 * deci limita implicită Prisma de 5 s cade la documentele lungi.
 *
 * Plafonul real e `maxDuration` al paginii /crm (60 s pe Hobby), de unde
 * pornesc toate acțiunile: marja stă puțin sub el, ca documentul prea lung să
 * pice cu mesajul Prisma, nu cu un 504 mut. Pe Vercel Pro urcă amândouă la 300.
 *
 * ponytail: marjă lărgită, nu batching — la sute de linii tot nu ajunge;
 * refolosește atunci ensureWarehouseStockRows/applyWarehouseStockDeltas din
 * operations/actions.ts, care scriu toate liniile din câteva query-uri.
 */
export const DOCUMENT_TX_OPTIONS = { timeout: 55_000, maxWait: 15_000 } as const;
