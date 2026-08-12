export type VehicleFitmentInfo = {
  yearStart: number | null;
  yearEnd: number | null;
  yearOpenEnded: boolean;
  carModel: { name: string; brand: { name: string } };
};

/** Toate fitmenturile unui produs: cel principal + legăturile ProductFitment. */
export type ProductFitmentsInfo = {
  fitment?: VehicleFitmentInfo | null;
  productFitments?: { fitment: VehicleFitmentInfo }[] | null;
};

/** „Marca Model ani" pentru fitmentul principal al unui produs; null fără fitment. */
export function vehicleLabel(fitment: VehicleFitmentInfo | null | undefined): string | null {
  if (!fitment) return null;
  const years = formatYears(fitment);
  return [fitment.carModel.brand.name, fitment.carModel.name, years]
    .filter(Boolean)
    .join(" ");
}

/**
 * Toate compatibilitățile produsului, separate cu „ • ": piesele legate de mai
 * multe modele (gemenii Sprinter/Crafter etc.) trebuie recunoscute din etichetă.
 */
export function vehicleLabels(product: ProductFitmentsInfo): string | null {
  const fitments = [
    product.fitment,
    ...(product.productFitments ?? []).map((entry) => entry.fitment),
  ].filter((fitment): fitment is VehicleFitmentInfo => Boolean(fitment));

  const seen = new Set<string>();
  const labels: string[] = [];
  for (const fitment of fitments) {
    const label = vehicleLabel(fitment);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }

  return labels.length > 0 ? labels.join(" • ") : null;
}

function formatYears(fitment: VehicleFitmentInfo) {
  if (fitment.yearStart == null) return "";
  if (fitment.yearOpenEnded) return `${fitment.yearStart}–prezent`;
  if (fitment.yearEnd != null) return `${fitment.yearStart}–${fitment.yearEnd}`;
  return `din ${fitment.yearStart}`;
}
