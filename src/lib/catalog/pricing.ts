/** Preț de vânzare implicit = dublul costului de achiziție, rotunjit la 50 lei. */
export function computeSalePrice(costLei: number | null): number | null {
  if (costLei == null) return null;
  return Math.round((costLei * 2) / 50) * 50;
}

export type ProductPricing = {
  costLei: number | null;
  salePriceLei: number | null;
};

/**
 * Recepția stabilește costul: dacă prețul recepționat diferă de costul din fișa
 * produsului, costul îl urmează. Prețul de vânzare se recalculează DOAR dacă era
 * cel automat — prețurile ajustate manual rămân neatinse.
 * Întoarce null când nu e nimic de schimbat.
 */
export function receiptPricingUpdate(
  current: ProductPricing,
  receivedCostLei: number,
): { costLei: number; salePriceLei?: number | null } | null {
  if (!Number.isFinite(receivedCostLei) || receivedCostLei < 0) return null;
  if (current.costLei === receivedCostLei) return null;

  const wasAuto =
    current.salePriceLei == null ||
    current.salePriceLei === computeSalePrice(current.costLei);

  return wasAuto
    ? { costLei: receivedCostLei, salePriceLei: computeSalePrice(receivedCostLei) }
    : { costLei: receivedCostLei };
}
