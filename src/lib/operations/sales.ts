export type SaleLine = {
  productId: string;
  quantity: number;
  unitPriceEuro: number | null;
};

export function parseSaleLines(input: {
  productIds: string[];
  quantities: string[];
  unitPricesEuro: string[];
}): SaleLine[] {
  if (input.productIds.length === 0) {
    throw new Error("Adaugă cel puțin un produs în vânzare.");
  }

  const seenProducts = new Set<string>();

  return input.productIds.map((rawProductId, index) => {
    const position = index + 1;
    const productId = rawProductId.trim();
    const quantity = Number(input.quantities[index] ?? "");
    const rawPrice = (input.unitPricesEuro[index] ?? "").trim().replace(",", ".");
    const unitPriceEuro = rawPrice ? Number(rawPrice) : null;

    if (!productId) {
      throw new Error(`Alege produsul de pe poziția ${position}.`);
    }

    if (seenProducts.has(productId)) {
      throw new Error(`Produsul de pe poziția ${position} este adăugat de mai multe ori.`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(
        `Cantitatea de pe poziția ${position} trebuie să fie mai mare decât zero.`,
      );
    }

    if (unitPriceEuro !== null && (!Number.isFinite(unitPriceEuro) || unitPriceEuro < 0)) {
      throw new Error(`Prețul de pe poziția ${position} nu este valid.`);
    }

    seenProducts.add(productId);
    return { productId, quantity, unitPriceEuro };
  });
}

export function calculateSaleTotalEuro(lines: SaleLine[]) {
  const pricedLines = lines.filter((line) => line.unitPriceEuro !== null);

  if (pricedLines.length === 0) {
    return null;
  }

  return pricedLines.reduce(
    (total, line) => total + line.quantity * (line.unitPriceEuro ?? 0),
    0,
  );
}

export function aggregateSoldProducts(lines: Array<{ productId: string; quantity: number }>) {
  const totals = new Map<string, number>();

  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  }

  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}
