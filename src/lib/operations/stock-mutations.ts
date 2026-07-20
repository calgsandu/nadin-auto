import type { Prisma } from "@/generated/prisma/client";

export async function nextStockDocumentNumber(
  tx: Prisma.TransactionClient,
  type: "RECEIPT" | "ADJUSTMENT" | "SALE" | "RETURN",
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stockdoc:${type}`}))`;
  const last = await tx.stockDocument.findFirst({
    where: { type },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

export async function ensureWarehouseStockRow(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string,
) {
  const existing = await tx.warehouseStock.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  if (existing) return existing;

  const otherRows = await tx.warehouseStock.count({ where: { productId } });
  const product =
    otherRows === 0
      ? await tx.product.findUnique({
          where: { id: productId },
          select: { stock: true },
        })
      : null;
  return tx.warehouseStock.create({
    data: { productId, warehouseId, quantity: product?.stock ?? 0 },
  });
}

export async function decrementWarehouseStock(
  tx: Prisma.TransactionClient,
  productId: string,
  warehouseId: string,
  quantity: number,
) {
  const stock = await ensureWarehouseStockRow(tx, productId, warehouseId);
  const rows = await tx.$queryRaw<{ quantity: number }[]>`
    UPDATE "WarehouseStock"
    SET quantity = quantity - ${quantity}, "updatedAt" = now()
    WHERE id = ${stock.id} AND quantity >= ${quantity}
    RETURNING quantity`;
  if (rows.length !== 1) {
    throw new Error(
      "Stoc insuficient în locația selectată (modificat între timp).",
    );
  }
}

export async function syncProductAggregateStock(
  tx: Prisma.TransactionClient,
  productId: string,
) {
  const stocks = await tx.warehouseStock.findMany({
    where: { productId },
    select: { quantity: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: {
      stock: stocks.reduce((sum, stock) => sum + stock.quantity, 0),
      manuallyEdited: true,
    },
  });
}
