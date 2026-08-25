import type { Prisma } from "@/generated/prisma/client";

type PriceSnapshot = {
  costLei: Prisma.Decimal | null;
  salePriceLei: Prisma.Decimal | null;
  priceEuro: Prisma.Decimal | null;
};

const same = (a: Prisma.Decimal | null, b: Prisma.Decimal | null) => {
  if (a === null || b === null) return a === b;
  return a.equals(b);
};

/** Vreuna dintre cele trei valori de preț s-a schimbat? */
export function pricesChanged(before: PriceSnapshot, after: PriceSnapshot) {
  return (
    !same(before.costLei, after.costLei)
    || !same(before.salePriceLei, after.salePriceLei)
    || !same(before.priceEuro, after.priceEuro)
  );
}

/**
 * Scrie o intrare în istoricul de prețuri, dar numai dacă vreo valoare chiar
 * s-a schimbat: o editare de denumire nu trebuie să umple registrul cu rânduri
 * în care nimic nu diferă.
 */
export async function recordPriceChange(
  tx: Prisma.TransactionClient,
  productId: string,
  before: PriceSnapshot,
  after: PriceSnapshot,
  user: { id?: string | null; name?: string | null; email?: string | null } | null,
) {
  if (!pricesChanged(before, after)) return false;

  await tx.priceChange.create({
    data: {
      productId,
      costLeiBefore: before.costLei,
      costLeiAfter: after.costLei,
      salePriceLeiBefore: before.salePriceLei,
      salePriceLeiAfter: after.salePriceLei,
      priceEuroBefore: before.priceEuro,
      priceEuroAfter: after.priceEuro,
      changedById: user?.id ?? null,
      changedByName: user?.name ?? user?.email ?? null,
    },
  });

  return true;
}
