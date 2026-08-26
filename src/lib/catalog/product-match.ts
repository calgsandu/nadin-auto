import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

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

/*
 * Aceleași normalizări, dar în SQL — `translate` mapează caracter cu caracter.
 * Nu folosim `unaccent`: ar cere o extensie și nu acoperă decât parțial româna.
 */
const NORMALIZED_TEXT = Prisma.sql`
  translate(
    lower(
      concat_ws(' ',
        p."externalCode", p."alternativeCode", p.description, p."descriptionRu",
        t.name, b.name, m.name, f.label, f."labelRu", compat.txt
      )
    ),
    'ăâîíșşțţ', 'aaiisstt'
  )`;

/** Denumirea piesei (ce scrie omul cel mai des): descriere + tip. */
const NORMALIZED_PART = Prisma.sql`
  translate(
    lower(concat_ws(' ', p.description, p."descriptionRu", t.name)),
    'ăâîíșşțţ', 'aaiisstt'
  )`;

/** Mașina: marcă, model, ani, plus compatibilitățile legate. */
const NORMALIZED_VEHICLE = Prisma.sql`
  translate(
    lower(concat_ws(' ', b.name, m.name, f.label, f."labelRu", compat.txt)),
    'ăâîíșşțţ', 'aaiisstt'
  )`;

/**
 * Anul cade în intervalul de fabricație — pe fitmentul principal sau pe oricare
 * dintre compatibilitățile piesei. `yearOpenEnded` = „de la X încoace".
 */
function yearCovered(year: number) {
  return Prisma.sql`(
    (f."yearStart" <= ${year} AND (f."yearEnd" >= ${year} OR f."yearOpenEnded"))
    OR EXISTS (
      SELECT 1 FROM "ProductFitment" pf2
        JOIN "VehicleFitment" f3 ON f3.id = pf2."fitmentId"
       WHERE pf2."productId" = p.id
         AND f3."yearStart" <= ${year}
         AND (f3."yearEnd" >= ${year} OR f3."yearOpenEnded")
    )
  )`;
}

const NORMALIZED_CODE = Prisma.sql`
  regexp_replace(
    upper(concat_ws(' ', p."externalCode", p."alternativeCode")),
    '[^A-Z0-9]', '', 'g'
  )`;

/**
 * Id-urile produselor care se potrivesc căutării:
 *   - codul, comparat fără spații/cratime (deci „P149031" găsește „P14903 1");
 *   - SAU toți termenii, oriunde în cod, denumire, tip, marcă, model sau
 *     compatibilități — fără diacritice și fără să conteze ordinea cuvintelor.
 *
 * Un termen care e an („2005") se potrivește și pe intervalul de fabricație, nu
 * doar ca text. Dacă niciun produs n-are TOȚI termenii, a doua trecere cere
 * măcar unul și lasă scorul să ridice potrivirile cele mai complete.
 *
 * Rulează pe ~2.000 de produse, deci scanarea completă e ieftină; dacă tabelul
 * crește mult, aici se pune un index trigram (pg_trgm) pe textul normalizat.
 */
export async function findMatchingProductIds(
  query: string,
  limit = 200,
): Promise<string[]> {
  const terms = searchTerms(query);
  const code = normalizeCode(query);
  const phrase = normalizeText(query).trim();
  if (terms.length === 0 && !code) return [];

  const termConditions = terms.map((term) => {
    const year = parseYearTerm(term);
    if (year === null) return Prisma.sql`${NORMALIZED_TEXT} LIKE ${`%${term}%`}`;
    // Anul se caută și ca text (poate fi bucată de cod), și ca an de fabricație
    // acoperit de fitment — altfel „2005" nu găsea o piesă de BMW E46 /98-06/.
    return Prisma.sql`(${NORMALIZED_TEXT} LIKE ${`%${term}%`} OR ${yearCovered(year)})`;
  });
  function conditionsFor(joiner: "AND" | "OR") {
    const conditions: Prisma.Sql[] = [];
    if (code) conditions.push(Prisma.sql`${NORMALIZED_CODE} LIKE ${`%${code}%`}`);
    if (termConditions.length > 0) {
      conditions.push(Prisma.sql`(${Prisma.join(termConditions, ` ${joiner} `)})`);
    }
    return conditions;
  }

  /*
   * Scor de relevanță: codul exact bate tot, apoi fraza întreagă, apoi fiecare
   * termen — mai greu în denumirea piesei decât în restul textului, cu bonus
   * când termenul apare ca CUVÂNT întreg („907" nu doar ca bucată din 1907).
   */
  const termScores = terms.flatMap((term) => {
    const year = parseYearTerm(term);
    return [
      Prisma.sql`(CASE WHEN ${NORMALIZED_PART} LIKE ${`%${term}%`} THEN 30 ELSE 0 END)`,
      Prisma.sql`(CASE WHEN ${NORMALIZED_VEHICLE} LIKE ${`%${term}%`} THEN 25 ELSE 0 END)`,
      Prisma.sql`(CASE WHEN concat(' ', ${NORMALIZED_TEXT}, ' ') LIKE ${`% ${term} %`} THEN 12 ELSE 0 END)`,
      ...(year === null
        ? []
        : [Prisma.sql`(CASE WHEN ${yearCovered(year)} THEN 25 ELSE 0 END)`]),
    ];
  });
  const scoreParts: Prisma.Sql[] = [
    Prisma.sql`(CASE
      WHEN ${code} <> '' AND ${NORMALIZED_CODE} = ${code} THEN 1000
      WHEN ${code} <> '' AND ${NORMALIZED_CODE} LIKE ${`${code}%`} THEN 600
      WHEN ${code} <> '' AND ${NORMALIZED_CODE} LIKE ${`%${code}%`} THEN 300
      ELSE 0 END)`,
    Prisma.sql`(CASE WHEN ${phrase} <> '' AND ${NORMALIZED_PART} LIKE ${`%${phrase}%`} THEN 150 ELSE 0 END)`,
    ...termScores,
  ];

  async function run(joiner: "AND" | "OR") {
    const conditions = conditionsFor(joiner);
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT p.id, (${Prisma.join(scoreParts, " + ")}) AS score
    FROM "Product" p
    JOIN "ProductType" t ON t.id = p."typeId"
    JOIN "VehicleFitment" f ON f.id = p."fitmentId"
    JOIN "CarModel" m ON m.id = f."carModelId"
    JOIN "Brand" b ON b.id = m."brandId"
    LEFT JOIN LATERAL (
      SELECT string_agg(concat_ws(' ', f2.label, m2.name, b2.name), ' ') AS txt
      FROM "ProductFitment" pf
      JOIN "VehicleFitment" f2 ON f2.id = pf."fitmentId"
      JOIN "CarModel" m2 ON m2.id = f2."carModelId"
      JOIN "Brand" b2 ON b2.id = m2."brandId"
      WHERE pf."productId" = p.id
    ) compat ON TRUE
    WHERE ${Prisma.join(conditions, " OR ")}
    ORDER BY score DESC, p.description ASC
    LIMIT ${limit}
  `;
    return rows.map((row) => row.id);
  }

  const strict = await run("AND");
  if (strict.length > 0 || terms.length < 2) return strict;

  /*
   * Niciun rezultat cu toți termenii: un singur cuvânt pe care nimeni nu l-a
   * scris în catalog („aripa fata dreapta" — în bază scrie „L"/„R") golea toată
   * lista. A doua trecere cere măcar un termen, iar scorul urcă deasupra
   * produsele care potrivesc cele mai multe.
   */
  return run("OR");
}
