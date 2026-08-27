import { normalizeText, parseYearTerm, searchTerms } from "@/lib/catalog/search-text";

export type StickerLine = { productId: string; sticker?: boolean; copies?: string };

/** Rândurile bifate care chiar au produs (liniile externe n-au etichetă). */
export function stickerLines(lines: StickerLine[]) {
  return lines.filter((line) => line.sticker && line.productId);
}

/** Câte etichete ies din rândurile bifate. */
export function countStickers(lines: StickerLine[]) {
  return stickerLines(lines).reduce((sum, line) => sum + (Number(line.copies) || 0), 0);
}

/** `items=<produs>:<copii>` pentru /print/labels; gol = nimic de printat. */
export function buildStickerItems(lines: StickerLine[]) {
  return stickerLines(lines)
    .map((line) => `${line.productId}:${Math.max(Number(line.copies) || 1, 1)}`)
    .join(",");
}

/**
 * Rândul se vede dacă filtrul e gol, dacă e încă necompletat sau dacă se
 * potrivește.
 *
 * Se compară ca la căutarea de produs: fără diacritice, termen cu termen, în
 * orice ordine. Înainte era un `includes` pe textul brut, deci „Panou usa" nu
 * găsea „Panou ușă", iar „usa panou" nu găsea nimic.
 */
export function matchesLineFilter(filter: string, line: { productId: string; label?: string }) {
  const terms = searchTerms(filter);
  if (terms.length === 0 || !line.productId) return true;

  const label = normalizeText(line.label ?? "");
  return terms.every((term) => {
    if (label.includes(term)) return true;
    const year = parseYearTerm(term);
    return year !== null && labelCoversYear(label, year);
  });
}

/**
 * Eticheta poartă anii ca interval („bmw e46 1998–2006", „... 2003–prezent"),
 * deci un an din mijloc nu se găsea ca text.
 */
function labelCoversYear(label: string, year: number) {
  for (const match of label.matchAll(/(\d{4})–(\d{4}|prezent)/g)) {
    const start = Number(match[1]);
    const end = match[2] === "prezent" ? Number.POSITIVE_INFINITY : Number(match[2]);
    if (year >= start && year <= end) return true;
  }
  return false;
}
