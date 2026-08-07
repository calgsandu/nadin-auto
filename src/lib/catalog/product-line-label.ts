import { vehicleLabel, type VehicleFitmentInfo } from "@/lib/catalog/vehicle-label";

export type ProductLineInfo = {
  externalCode: string | null;
  description: string;
  type?: { name: string } | null;
  fitment?: VehicleFitmentInfo | null;
};

/**
 * Eticheta completă a unei linii de document — aceeași formă ca la căutarea de
 * produs în dialogul de creare: `cod · MARCĂ MODEL ani · tip · descriere`.
 */
export function productLineLabel(product: ProductLineInfo) {
  const vehicle = vehicleLabel(product.fitment);
  return [
    product.externalCode?.trim() || null,
    vehicle,
    product.type?.name ?? null,
    product.description,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Subtitlul unei linii: `MARCĂ MODEL ani · tip`, fără cod și descriere. */
export function productLineSubtitle(product: ProductLineInfo) {
  return [vehicleLabel(product.fitment), product.type?.name ?? null]
    .filter(Boolean)
    .join(" · ") || null;
}
