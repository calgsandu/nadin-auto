/**
 * Normalizările căutării, fără nimic din Prisma.
 *
 * Stăteau în `product-match.ts`, care importă clientul de bază de date: filtrul
 * din dialoguri rulează în browser și n-avea cum să le refolosească, așa că
 * ajunsese să compare textul brut — „Panou usa" nu găsea „Panou ușă".
 */
/** Codul, redus la litere și cifre: „P14903 1" și „P149031" trebuie să se caute la fel. */
export function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Text de căutare: litere mici, fără diacritice românești. */
export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/[îí]/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t");
}

/**
 * Anul din termen, dacă termenul e un an: „2005" → 2005, „e46" → null.
 *
 * Anii mașinii sunt coloane numerice, iar în etichetă apar prescurtați
 * („/98-06/"), deci „2005" nu putea fi găsit ca text nicăieri.
 */
export function parseYearTerm(term: string) {
  if (!/^\d{4}$/.test(term)) return null;
  const year = Number(term);
  return year >= 1950 && year <= 2100 ? year : null;
}

/** Termenii căutării: fiecare trebuie să apară undeva în produs (ȘI între termeni). */
export function searchTerms(query: string) {
  return normalizeText(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}
