import type { Prisma } from "@/generated/prisma/client";
import { receiptPricingUpdate } from "@/lib/catalog/pricing";

export type CostUpdate = {
  productId: string;
  previousCostLei: number | null;
  costLei: number;
  salePriceLei?: number | null;
};

/**
 * Aliniază fișa produsului la prețul recepționat. Regula de preț trăiește în
 * `receiptPricingUpdate` (pură, testată); aici e doar scrierea în DB.
 */
export async function applyReceiptCost(
  tx: Prisma.TransactionClient,
  productId: string,
  unitCostLei: number | null,
): Promise<CostUpdate | null> {
  if (unitCostLei == null) return null;

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { costLei: true, salePriceLei: true },
  });
  if (!product) return null;

  const current = {
    costLei: product.costLei == null ? null : Number(product.costLei),
    salePriceLei: product.salePriceLei == null ? null : Number(product.salePriceLei),
  };
  const update = receiptPricingUpdate(current, unitCostLei);
  if (!update) return null;

  await tx.product.update({ where: { id: productId }, data: update });
  return { productId, previousCostLei: current.costLei, ...update };
}
