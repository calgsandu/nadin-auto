/**
 * Normalizarea textului de pricelist, partajată de importer și de auditul de coduri
 * — dacă cele două ar avea copii proprii, auditul ar raporta drift acolo unde
 * importerul potrivește corect.
 */

const LOCAL_RE = /\/\s*local\s*\/?/gi;

/** Scoate markerele furnizorului (`ZZZ`, `/local/`) și spune dacă piesa e locală. */
export function stripMarkers(raw: string) {
  let desc = raw.replace(/ZZZ/g, " ");
  const isLocal = LOCAL_RE.test(desc);
  desc = desc.replace(LOCAL_RE, " ").replace(/\s+/g, " ").trim();
  return { desc, isLocal };
}

/** Cheie de comparare: doar litere și cifre, majuscule. */
export function canon(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9ĂÂÎȘȚ]+/g, "");
}

const TYPO_FIXES: Array<[RegExp, string]> = [
  [/Mîiner/g, "Mâner"],
  [/mîiner/g, "mâner"],
  [/Mecanizm/g, "Mecanism"],
  [/mecanizm/g, "mecanism"],
  [/Diuză/g, "Duză"],
  [/diuză/g, "duză"],
  [/Stîlp/g, "Stâlp"],
  [/stîlp/g, "stâlp"],
  [/Jgheag/g, "Jgheab"],
  [/jgheag/g, "jgheab"],
  [/Aripa/g, "Aripă"],
];

/** Ortografia furnizorului → nomenclatura curățată la auditul din 07.2026. */
export function fixTypos(value: string) {
  return TYPO_FIXES.reduce((acc, [pattern, to]) => acc.replace(pattern, to), value);
}
