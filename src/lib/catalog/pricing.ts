/** Preț de vânzare implicit = dublul costului de achiziție, rotunjit la 50 lei. */
export function computeSalePrice(costLei: number | null): number | null {
  if (costLei == null) return null;
  return Math.round((costLei * 2) / 50) * 50;
}

export type ProductPricing = {
  costLei: number | null;
  salePriceLei: number | null;
  /** Bucățile aflate în stoc ÎNAINTE de recepție. */
  stock?: number | null;
};

/**
 * Costul mediu ponderat după o recepție:
 *   (stoc_vechi × cost_vechi + cantitate × cost_nou) / (stoc_vechi + cantitate)
 *
 * Regula veche era „ultimul preț câștigă": o singură bucată adusă mai scump
 * rescria costul întregului stoc, iar profitul raportat scădea pe hârtie fără
 * ca ceva să se fi vândut. Fără stoc vechi (sau fără cost vechi) media e chiar
 * prețul recepționat.
 */
export function weightedAverageCost(
  current: { costLei: number | null; stock?: number | null },
  receivedCostLei: number,
  receivedQuantity: number,
): number {
  const previousStock = Math.max(current.stock ?? 0, 0);
  const quantity = Math.max(receivedQuantity, 0);

  if (current.costLei == null || previousStock === 0 || quantity === 0) {
    return round(receivedCostLei);
  }

  const total = previousStock * current.costLei + quantity * receivedCostLei;
  return round(total / (previousStock + quantity));
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Recepția mută costul spre media ponderată a stocului, nu spre ultimul preț.
 * Prețul de vânzare se recalculează DOAR dacă era cel automat — prețurile
 * ajustate manual rămân neatinse. Întoarce null când nu e nimic de schimbat.
 */
export function receiptPricingUpdate(
  current: ProductPricing,
  receivedCostLei: number,
  receivedQuantity = 0,
): { costLei: number; salePriceLei?: number | null } | null {
  if (!Number.isFinite(receivedCostLei) || receivedCostLei < 0) return null;

  const costLei = weightedAverageCost(current, receivedCostLei, receivedQuantity);
  if (current.costLei === costLei) return null;

  const wasAuto =
    current.salePriceLei == null ||
    current.salePriceLei === computeSalePrice(current.costLei);

  return wasAuto
    ? { costLei, salePriceLei: computeSalePrice(costLei) }
    : { costLei };
}
