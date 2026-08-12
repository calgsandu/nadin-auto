import {
  vehicleLabels,
  type ProductFitmentsInfo,
  type VehicleFitmentInfo,
} from "@/lib/catalog/vehicle-label";

export type ProductLineInfo = ProductFitmentsInfo & {
  externalCode: string | null;
  description: string;
  type?: { name: string } | null;
  fitment?: VehicleFitmentInfo | null;
};

/**
 * Eticheta completă a unei linii de document — aceeași formă ca la căutarea de
 * produs în dialogul de creare: `cod · MARCĂ MODEL ani [• alte modele] · tip · descriere`.
 */
export function productLineLabel(product: ProductLineInfo) {
  return [
    product.externalCode?.trim() || null,
    vehicleLabels(product),
    product.type?.name ?? null,
    product.description,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Subtitlul unei linii: `MARCĂ MODEL ani · tip`, fără cod și descriere. */
export function productLineSubtitle(product: ProductLineInfo) {
  return [vehicleLabels(product), product.type?.name ?? null]
    .filter(Boolean)
    .join(" · ") || null;
}
