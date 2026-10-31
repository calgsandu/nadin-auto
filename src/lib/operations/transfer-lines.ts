import { mergeLinesByProduct } from "@/lib/operations/merge-lines";

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


  const lines = input.productIds.map((rawProductId, index) => {
    const position = index + 1;
    const productId = rawProductId.trim();
    const quantity = Number(input.quantities[index] ?? "");

    if (!productId) {
      throw new Error(`Alege produsul de pe poziția ${position}.`);
    }


    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(
        `Cantitatea de pe poziția ${position} trebuie să fie mai mare decât zero.`,
      );
    }

    return { productId, quantity };
  });
  // Același produs de două ori: un singur rând, cantitățile adunate.
  return mergeLinesByProduct(lines, (line) => line.productId);
}
