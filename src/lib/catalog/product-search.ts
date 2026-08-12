import {
  vehicleLabels,
  type ProductFitmentsInfo,
  type VehicleFitmentInfo,
} from "@/lib/catalog/vehicle-label";

export const PRODUCT_SEARCH_LIMIT = 20;

export type ProductSearchResult = {
  id: string;
  label: string;
  defaultPriceEuro: string;
  defaultCostLei: string;
  salePriceLei: string;
  stock: number;
};

export type ProductSearchLabelInput = ProductFitmentsInfo & {
  externalCode: string | null;
  description: string;
  priceEuro: { toString(): string } | null;
  costLei: { toString(): string } | null;
  salePriceLei: { toString(): string } | null;
  stock: number | null;
  fitment: VehicleFitmentInfo;
  type: {
    name: string;
  };
};

export function normalizeProductSearchQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 20);

  return normalized.length >= 3 ? normalized : "";
}

export function formatProductSearchLabel(
  product: ProductSearchLabelInput,
  includeCosts = true,
) {
  // Toate compatibilitățile, nu doar fitmentul principal: piesele legate de mai
  // multe modele trebuie recunoscute direct din rezultatul căutării.
  const vehicles = vehicleLabels(product) ?? "";
  const code = product.externalCode?.trim() || "-";
  const price = includeCosts ? formatFormValue(product.priceEuro) : "";
  const pricePart = price ? ` · ${price} EUR` : "";

  return `${code} · ${vehicles} · ${product.type.name} · ${product.description}${pricePart}`;
}

/** `includeCosts=false` (ANGAJAT): costurile de aducere nu pleacă din API. */
export function toProductSearchResult(
  product: ProductSearchLabelInput & { id: string },
  includeCosts = true,
) {
  return {
    id: product.id,
    label: formatProductSearchLabel(product, includeCosts),
    defaultPriceEuro: includeCosts ? formatFormValue(product.priceEuro) : "",
    defaultCostLei: includeCosts ? formatFormValue(product.costLei) : "",
    salePriceLei: formatFormValue(product.salePriceLei),
    stock: product.stock ?? 0,
  };
}

function formatFormValue(value: { toString(): string } | null | undefined) {
  return value === null || value === undefined ? "" : value.toString();
}
