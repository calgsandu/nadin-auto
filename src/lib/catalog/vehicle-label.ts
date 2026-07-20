export type VehicleFitmentInfo = {
  yearStart: number | null;
  yearEnd: number | null;
  yearOpenEnded: boolean;
  carModel: { name: string; brand: { name: string } };
};

/** „Marca Model ani" pentru fitmentul principal al unui produs; null fără fitment. */
export function vehicleLabel(fitment: VehicleFitmentInfo | null | undefined): string | null {
  if (!fitment) return null;
  const years =
    fitment.yearStart == null
      ? ""
      : fitment.yearOpenEnded
        ? `${fitment.yearStart}–prezent`
        : fitment.yearEnd != null
          ? `${fitment.yearStart}–${fitment.yearEnd}`
          : `din ${fitment.yearStart}`;
  return [fitment.carModel.brand.name, fitment.carModel.name, years]
    .filter(Boolean)
    .join(" ");
}
