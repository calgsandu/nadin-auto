"use server";

import { requireCurrentAppUser } from "@/lib/auth/access";
import { labelCompatibility, loadLabelProducts } from "@/lib/labels/request";

/**
 * Codul și denumirea pentru rândurile adăugate în lista de stickere fără ele
 * (din recepție, inventar, fișa produsului) — o singură cerere pentru toate.
 */
export async function stickerDetailsAction(ids: string[]) {
  await requireCurrentAppUser();
  const products = await loadLabelProducts(ids.slice(0, 200));
  return products.map((product) => ({
    id: product.id,
    code: product.externalCode ?? "",
    alternativeCode: product.alternativeCode ?? "",
    name: product.description,
    compatibility: labelCompatibility(product),
  }));
}
