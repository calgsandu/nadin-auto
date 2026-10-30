import type { Prisma } from "@/generated/prisma/client";

export type RestockStatus = "PENDING" | "DELIVERED" | "UNAVAILABLE";

export function aggregateRestockRequests(
  lines: Array<{ productId: string; quantity: number }>,
) {
  const totals = new Map<string, number>();

  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  }

  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Ce trebuie adus în 110A, cu stocul pe depozite — transferul se completează singur. */
export type RestockTransferPrefill = {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  items: { productId: string; label: string; quantity: number }[];
  stocks: { productId: string; warehouseId: string; quantity: number }[];
};

/**
 * Depozitul din care se poate aduce cel mai mult din listă — sursa propusă
 * implicit. La egalitate rămâne primul din ordinea primită.
 */
export function bestRestockSource(
  items: Array<{ productId: string; quantity: number }>,
  stocks: Array<{ productId: string; warehouseId: string; quantity: number }>,
  warehouseIds: string[],
) {
  let best = warehouseIds[0] ?? "";
  let bestCovered = -1;
  for (const warehouseId of warehouseIds) {
    const covered = items.reduce((sum, item) => {
      const available =
        stocks.find((stock) => stock.productId === item.productId && stock.warehouseId === warehouseId)?.quantity ?? 0;
      return sum + Math.min(item.quantity, available);
    }, 0);
    if (covered > bestCovered) {
      best = warehouseId;
      bestCovered = covered;
    }
  }
  return best;
}

/**
 * Ce poziții „De adus" acoperă un transfer în 110A: cele mai vechi întâi, cât
 * ajunge cantitatea adusă. O poziție acoperită doar parțial rămâne în listă.
 */
export function restockTasksCoveredBy(
  tasks: Array<{ id: string; quantity: number }>,
  transferredQuantity: number,
) {
  const covered: string[] = [];
  let left = transferredQuantity;
  for (const task of tasks) {
    if (task.quantity > left) break;
    covered.push(task.id);
    left -= task.quantity;
  }
  return covered;
}

export function splitRestockTasksByStatus<T extends { status: RestockStatus }>(
  tasks: T[],
) {
  return {
    pending: tasks.filter((task) => task.status === "PENDING"),
    unavailable: tasks.filter((task) => task.status === "UNAVAILABLE"),
    // `DELIVERED` se scria și nu se afișa nicăieri: o poziție adusă dispărea din
    // ecran fără nicio confirmare că a fost chiar adusă, nu ștearsă.
    delivered: tasks.filter((task) => task.status === "DELIVERED"),
  };
}

/**
 * Recalculează reminderul „De adus” din adevărul contabil:
 * cantitatea vândută minus toate retururile legate.
 * O sarcină deja rezolvată rămâne istoric și nu este redeschisă.
 */
export async function reconcileSaleRestockTasks(
  tx: Prisma.TransactionClient,
  saleDocumentId: string,
) {
  const sale = await tx.stockDocument.findUnique({
    where: { id: saleDocumentId },
    include: {
      lines: { select: { productId: true, quantity: true } },
      warehouse: { select: { name: true } },
    },
  });
  if (!sale || sale.type !== "SALE" || sale.warehouse.name !== "Pavilion 110A") {
    return;
  }

  const [returnLines, tasks] = await Promise.all([
    tx.stockDocumentLine.findMany({
      where: {
        document: { type: "RETURN", sourceDocumentId: sale.id },
      },
      select: { productId: true, quantity: true },
    }),
    tx.restockTask.findMany({ where: { sourceDocumentId: sale.id } }),
  ]);
  const returnedByProduct = new Map<string, number>();
  for (const line of returnLines) {
    if (!line.productId) continue;
    returnedByProduct.set(
      line.productId,
      (returnedByProduct.get(line.productId) ?? 0) + line.quantity,
    );
  }

  for (const line of sale.lines) {
    // Liniile externe (fără produs în catalog) nu generează sarcini De adus.
    if (!line.productId) continue;
    const desired = Math.max(
      0,
      line.quantity - (returnedByProduct.get(line.productId) ?? 0),
    );
    const productTasks = tasks.filter(
      (task) => task.productId === line.productId,
    );
    const pending = productTasks.filter((task) => task.status === "PENDING");
    const hasResolved = productTasks.some((task) => task.status !== "PENDING");

    if (pending.length > 0) {
      const [primary, ...duplicates] = pending;
      if (desired > 0) {
        await tx.restockTask.update({
          where: { id: primary.id },
          data: { quantity: desired },
        });
      } else {
        await tx.restockTask.delete({ where: { id: primary.id } });
      }
      if (duplicates.length > 0) {
        await tx.restockTask.deleteMany({
          where: { id: { in: duplicates.map((task) => task.id) } },
        });
      }
    } else if (!hasResolved && desired > 0) {
      await tx.restockTask.create({
        data: {
          productId: line.productId,
          warehouseId: sale.warehouseId,
          sourceDocumentId: sale.id,
          quantity: desired,
          requestedAt: sale.documentDate,
        },
      });
    }
  }
}
