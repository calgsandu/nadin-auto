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

/** Rândul se vede dacă filtrul e gol, dacă e încă necompletat sau dacă se potrivește. */
export function matchesLineFilter(filter: string, line: { productId: string; label?: string }) {
  const needle = filter.trim().toLowerCase();
  if (!needle || !line.productId) return true;
  return (line.label ?? "").toLowerCase().includes(needle);
}
