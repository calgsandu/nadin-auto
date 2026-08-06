import type { Prisma } from "@/generated/prisma/client";

export type InventoryFilters = {
  /** Depozitul inventariat. */
  warehouseId: string;
  /** Interval de date (YYYY-MM-DD), inclusiv. */
  from?: string;
  to?: string;
};

export function parseDay(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Inventarele unui depozit = ajustări marcate „Inventar", fără jumătățile de
 * transfer (acelea poartă transferGroupId). Sursă unică pentru listă + export.
 */
export function inventoryWhere({ warehouseId, from, to }: InventoryFilters): Prisma.StockDocumentWhereInput {
  const fromDay = parseDay(from);
  const toDay = parseDay(to);
  const documentDate =
    fromDay || toDay
      ? {
          ...(fromDay ? { gte: fromDay } : {}),
          ...(toDay ? { lte: new Date(toDay.getTime() + 24 * 60 * 60 * 1000 - 1) } : {}),
        }
      : undefined;

  return {
    type: "ADJUSTMENT",
    warehouseId,
    transferGroupId: null,
    notes: { startsWith: "Inventar" },
    ...(documentDate ? { documentDate } : {}),
  };
}

export const INVENTORY_PAGE_SIZE = 25;

export function normalizeInventoryPage(value: string | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}
