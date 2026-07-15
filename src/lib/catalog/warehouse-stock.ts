export type WarehouseStockAssignment = {
  warehouseId: string;
  quantity: number;
};

export function parseWarehouseStockAssignments(
  input: { warehouseIds: string[]; quantities: string[] },
  activeWarehouses: Array<{ id: string }>,
): WarehouseStockAssignment[] {
  if (input.warehouseIds.length !== input.quantities.length) {
    throw new Error("Câmpurile pentru depozite și cantități nu corespund.");
  }

  const activeIds = new Set(activeWarehouses.map((warehouse) => warehouse.id));
  const seen = new Set<string>();
  const assignments = new Map<string, number>();

  input.warehouseIds.forEach((rawWarehouseId, index) => {
    const warehouseId = rawWarehouseId.trim();
    if (!warehouseId || !activeIds.has(warehouseId)) {
      throw new Error(`Depozitul de pe poziția ${index + 1} nu este activ sau nu există.`);
    }

    if (seen.has(warehouseId)) {
      throw new Error(`Depozitul de pe poziția ${index + 1} este adăugat de mai multe ori.`);
    }

    const rawQuantity = input.quantities[index]?.trim() ?? "";
    const quantity = rawQuantity === "" ? 0 : Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`Cantitatea pentru depozitul ${warehouseId} trebuie să fie un număr întreg nenegativ.`);
    }

    seen.add(warehouseId);
    assignments.set(warehouseId, quantity);
  });

  if (seen.size !== activeIds.size) {
    throw new Error("Completează câte o cantitate pentru fiecare depozit activ.");
  }

  return activeWarehouses.map((warehouse) => ({
    warehouseId: warehouse.id,
    quantity: assignments.get(warehouse.id) ?? 0,
  }));
}

export function calculateWarehouseStockTotal(
  assignments: Array<{ quantity: number }>,
  preservedRows: Array<{ quantity: number }> = [],
) {
  return [...assignments, ...preservedRows].reduce(
    (total, row) => total + row.quantity,
    0,
  );
}
