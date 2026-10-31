export type ReceiptLine = {
  productId: string;
  quantity: number;
  unitCostLei: number | null;
};

export function parseReceiptLines(input: {
  productIds: string[];
  quantities: string[];
  unitCostsLei: string[];
}): ReceiptLine[] {
  if (input.productIds.length === 0) {
    throw new Error("Adaugă cel puțin un produs în recepție.");
  }

  const seenProducts = new Set<string>();

  return input.productIds.map((rawProductId, index) => {
    const position = index + 1;
    const productId = rawProductId.trim();
    const quantity = Number(input.quantities[index] ?? "");
    const rawUnitCost = (input.unitCostsLei[index] ?? "").trim().replace(",", ".");
    const unitCostLei = rawUnitCost ? Number(rawUnitCost) : null;

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

    if (unitCostLei !== null && (!Number.isFinite(unitCostLei) || unitCostLei < 0)) {
      throw new Error(`Costul de pe poziția ${position} nu este valid.`);
    }

    seenProducts.add(productId);
    return { productId, quantity, unitCostLei };
  });
}

export function calculateReceiptTotalLei(lines: ReceiptLine[]) {
  const linesWithCost = lines.filter((line) => line.unitCostLei !== null);

  if (linesWithCost.length === 0) {
    return null;
  }

  return linesWithCost.reduce(
    (total, line) => total + line.quantity * (line.unitCostLei ?? 0),
    0,
  );
}
