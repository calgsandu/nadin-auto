import type { Prisma } from "@/generated/prisma/client";

export const PRODUCT_SEARCH_LIMIT = 20;

export type ProductSearchResult = {
  id: string;
  label: string;
  defaultPriceEuro: string;
  defaultCostLei: string;
  salePriceLei: string;
  stock: number;
};

export type ProductSearchLabelInput = {
  externalCode: string | null;
  description: string;
  priceEuro: { toString(): string } | null;
  costLei: { toString(): string } | null;
  salePriceLei: { toString(): string } | null;
  stock: number | null;
  fitment: {
    carModel: {
      name: string;
      brand: {
        name: string;
      };
    };
  };
  type: {
    name: string;
  };
};

export function normalizeProductSearchQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 20);

  return normalized.length >= 3 ? normalized : "";
}

export function buildProductSearchWhere(query: string): Prisma.ProductWhereInput {
  return {
    OR: [
      { externalCode: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { fitment: { label: { contains: query, mode: "insensitive" } } },
      { fitment: { carModel: { name: { contains: query, mode: "insensitive" } } } },
      {
        fitment: {
          carModel: {
            brand: { name: { contains: query, mode: "insensitive" } },
          },
        },
      },
    ],
  };
}

export function formatProductSearchLabel(
  product: ProductSearchLabelInput,
  includeCosts = true,
) {
  const model = product.fitment.carModel;
  const code = product.externalCode?.trim() || "-";
  const price = includeCosts ? formatFormValue(product.priceEuro) : "";
  const pricePart = price ? ` · ${price} EUR` : "";

  return `${code} · ${model.brand.name} ${model.name} · ${product.type.name} · ${product.description}${pricePart}`;
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
