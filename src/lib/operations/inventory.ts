export type InventoryDocumentKind = "RECEIPT" | "SALE" | "RETURN" | "ADJUSTMENT";

export function validatePositiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Cantitatea trebuie să fie mai mare decât zero.");
  }
}

export function validateSaleAvailability(
  currentQuantity: number,
  requestedQuantity: number,
  productLabel?: string,
) {
  validatePositiveQuantity(requestedQuantity);

  if (currentQuantity < requestedQuantity) {
    throw new Error(
      `Stoc insuficient${productLabel ? ` pentru ${productLabel}` : ""} în locația selectată. Disponibil: ${currentQuantity}, cerut: ${requestedQuantity}.`,
    );
  }
}

export function validateDifferentWarehouses(sourceWarehouseId: string, destinationWarehouseId: string) {
  if (!sourceWarehouseId || !destinationWarehouseId) {
    throw new Error("Alege locația sursă și locația destinație.");
  }

  if (sourceWarehouseId === destinationWarehouseId) {
    throw new Error("Locațiile pentru transfer trebuie să fie diferite.");
  }
}

export function calculateNextQuantity(
  currentQuantity: number,
  documentKind: InventoryDocumentKind,
  quantity: number,
) {
  if (documentKind === "SALE") {
    validateSaleAvailability(currentQuantity, quantity);
    return currentQuantity - quantity;
  }

  if (documentKind === "ADJUSTMENT") {
    if (quantity === 0) {
      throw new Error("Cantitatea trebuie să fie diferită de zero.");
    }

    if (quantity < 0) {
      validateSaleAvailability(currentQuantity, Math.abs(quantity));
    }

    return currentQuantity + quantity;
  }

  validatePositiveQuantity(quantity);

  return currentQuantity + quantity;
}
