import type { Prisma } from "@/generated/prisma/client";
import { receiptPricingUpdate } from "@/lib/catalog/pricing";

export type CostUpdate = {
  productId: string;
  previousCostLei: number | null;
  costLei: number;
  salePriceLei?: number | null;
};

/**
 * Aliniază fișa produsului la prețul recepționat, ca medie ponderată. Regula
 * trăiește în `receiptPricingUpdate` (pură, testată); aici e doar scrierea în DB.
 *
 * ATENȚIE la ordine: funcția e apelată DUPĂ ce stocul a fost majorat cu marfa
 * recepționată, deci `product.stock` conține deja cantitatea nouă. Media are
 * nevoie de stocul de DINAINTE, așa că se scade `receivedQuantity` — altfel
 * marfa nouă ar fi numărată de două ori și media ar trage spre prețul vechi.
 */
export async function applyReceiptCost(
  tx: Prisma.TransactionClient,
  productId: string,
  unitCostLei: number | null,
  receivedQuantity = 0,
): Promise<CostUpdate | null> {
  if (unitCostLei == null) return null;

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { costLei: true, salePriceLei: true, stock: true },
  });
  if (!product) return null;

  const current = {
    costLei: product.costLei == null ? null : Number(product.costLei),
    salePriceLei: product.salePriceLei == null ? null : Number(product.salePriceLei),
    stock: Math.max((product.stock ?? 0) - receivedQuantity, 0),
  };
  const update = receiptPricingUpdate(current, unitCostLei, receivedQuantity);
  if (!update) return null;

  await tx.product.update({ where: { id: productId }, data: update });
  return { productId, previousCostLei: current.costLei, ...update };
}
