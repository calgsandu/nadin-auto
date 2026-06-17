export type TransferLine = {
  productId: string;
  quantity: number;
};

export function parseTransferLines(input: {
  productIds: string[];
  quantities: string[];
}): TransferLine[] {
  if (input.productIds.length === 0) {
    throw new Error("Adaugă cel puțin un produs în transfer.");
  }

  const seenProducts = new Set<string>();

  return input.productIds.map((rawProductId, index) => {
    const position = index + 1;
    const productId = rawProductId.trim();
    const quantity = Number(input.quantities[index] ?? "");

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

    seenProducts.add(productId);
    return { productId, quantity };
  });
}
