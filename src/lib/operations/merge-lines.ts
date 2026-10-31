/**
 * Același produs pe două rânduri nu mai e o eroare: rândurile se unesc într-unul
 * singur, cu cantitățile adunate (ex.: aceeași piesă numărată pe două rafturi,
 * sau adăugată de două ori din greșeală). Ordinea rămâne a primei apariții;
 * rândurile fără produs (piese externe) nu se ating.
 */
export function mergeLinesByProduct<T extends { quantity: number }>(
  lines: T[],
  productIdOf: (line: T) => string | null | undefined,
  mergeExtra: (kept: T, duplicate: T) => Partial<T> = () => ({}),
): T[] {
  const firstIndex = new Map<string, number>();
  const result: T[] = [];
  for (const line of lines) {
    const productId = productIdOf(line);
    const index = productId ? firstIndex.get(productId) : undefined;
    if (productId && index !== undefined) {
      const kept = result[index];
      result[index] = { ...kept, ...mergeExtra(kept, line), quantity: kept.quantity + line.quantity };
      continue;
    }
    if (productId) firstIndex.set(productId, result.length);
    result.push(line);
  }
  return result;
}

/**
 * Prețul rândului unit: același preț rămâne; prețuri diferite devin media
 * ponderată (totalul rămâne cel scris, la ban). Un preț gol înseamnă „nescris",
 * deci contează celălalt.
 */
export function mergedUnitPrice(
  kept: { quantity: number; price: number | null },
  duplicate: { quantity: number; price: number | null },
): number | null {
  if (kept.price === null) return duplicate.price;
  if (duplicate.price === null || duplicate.price === kept.price) return kept.price;
  const total = kept.quantity * kept.price + duplicate.quantity * duplicate.price;
  return Math.round((total / (kept.quantity + duplicate.quantity)) * 100) / 100;
}

/**
 * În formular: produsul ales pe rândul `lineId` e deja pe alt rând. Cantitatea
 * se adaugă acolo, iar rândul nou dispare. `null` = nu e dublură, rândul rămâne.
 */
export function mergeSelectionIntoExisting<L extends { id: number; productId: string; qty: string }>(
  lines: L[],
  lineId: number,
  productId: string,
  addQty: string,
): { lines: L[]; mergedInto: number } | null {
  const existing = productId
    ? lines.find((line) => line.id !== lineId && line.productId === productId)
    : undefined;
  if (!existing) return null;
  const quantity = (Number(existing.qty) || 0) + (Number(addQty) || 1);
  return {
    mergedInto: existing.id,
    lines: lines
      .filter((line) => line.id !== lineId)
      .map((line) => (line.id === existing.id ? { ...line, qty: String(quantity) } : line)),
  };
}
