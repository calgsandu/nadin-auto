/** Categorii de preț („Категория цены" din 1C) = discounturi predefinite pe document. */
export const PRICE_CATEGORIES = [
  { value: "0", label: "Realizare de bază" },
  { value: "5", label: "Client fidel (−5%)" },
  { value: "10", label: "En gros (−10%)" },
  { value: "15", label: "Partener (−15%)" },
];

/**
 * Prețul liniei după discount, pornind de la prețul din fișa produsului.
 * Întoarce "" când produsul n-are preț de listă — atunci prețul se scrie de mână.
 */
export function applyDiscount(listPrice: string, discountPercent: string) {
  const list = Number(listPrice);
  const discount = Number(discountPercent) || 0;
  if (!Number.isFinite(list) || list <= 0) return "";
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) return String(list);
  return String(Math.round(list * (1 - discount / 100) * 100) / 100);
}
