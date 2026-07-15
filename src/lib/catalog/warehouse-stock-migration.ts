export type ExistingWarehouseStockRow = {
  warehouseId: string;
  quantity: number;
};

export type ProductStockMigrationInput = {
  productId: string;
  legacyStock: number;
  existingRows: ExistingWarehouseStockRow[];
  warehouse110AId: string;
};

export function planProductWarehouseMigration(
  input: ProductStockMigrationInput,
) {
  if (input.existingRows.length > 0) {
    return {
      create110AQuantity: null,
      totalQuantity: input.existingRows.reduce((sum, row) => sum + row.quantity, 0),
    };
  }

  const legacyStock = Math.max(0, input.legacyStock);
  return {
    create110AQuantity: legacyStock,
    totalQuantity: legacyStock,
  };
}
