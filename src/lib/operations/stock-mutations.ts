import { Prisma } from "@/generated/prisma/client";

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

/**
 * Inventarul atinge zeci de poziții deodată. Făcute rând cu rând, interogările
 * depășesc limita de 5 s a tranzacției interactive (fiecare drum la Neon costă
 * zeci de ms), așa că pașii de mai jos lucrează pe loturi: câte o interogare
 * pentru toate produsele, nu câte una pentru fiecare.
 */

/** Rândurile de stoc ale unui depozit, create dacă lipsesc. Întoarce cantitățile curente. */
export async function ensureWarehouseStockRows(
  tx: Prisma.TransactionClient,
  productIds: string[],
  warehouseId: string,
): Promise<Map<string, number>> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return new Map();

  const existing = await tx.warehouseStock.findMany({
    where: { warehouseId, productId: { in: unique } },
    select: { productId: true, quantity: true },
  });
  const quantities = new Map(existing.map((row) => [row.productId, row.quantity]));

  const missing = unique.filter((productId) => !quantities.has(productId));
  if (missing.length > 0) {
    // Primul rând al unui produs preia stocul agregat; următoarele pornesc de la 0
    // (altfel stocul s-ar dubla — vezi ensureWarehouseStockRow).
    const [rowsElsewhere, products] = await Promise.all([
      tx.warehouseStock.groupBy({
        by: ["productId"],
        where: { productId: { in: missing } },
        _count: { _all: true },
      }),
      tx.product.findMany({
        where: { id: { in: missing } },
        select: { id: true, stock: true },
      }),
    ]);
    const hasRows = new Set(rowsElsewhere.map((row) => row.productId));
    const stockById = new Map(products.map((product) => [product.id, product.stock ?? 0]));

    const created = missing.map((productId) => ({
      productId,
      warehouseId,
      quantity: hasRows.has(productId) ? 0 : (stockById.get(productId) ?? 0),
    }));
    await tx.warehouseStock.createMany({ data: created, skipDuplicates: true });
    for (const row of created) quantities.set(row.productId, row.quantity);
  }

  return quantities;
}

/** Aplică toate diferențele dintr-un depozit într-un singur UPDATE. */
export async function applyWarehouseStockDeltas(
  tx: Prisma.TransactionClient,
  warehouseId: string,
  deltas: { productId: string; quantity: number }[],
) {
  if (deltas.length === 0) return;

  const values = deltas.map(
    (delta) => Prisma.sql`(${delta.productId}::text, ${delta.quantity}::int)`,
  );
  const updated = await tx.$executeRaw`
    UPDATE "WarehouseStock" w
    SET quantity = w.quantity + v.delta, "updatedAt" = now()
    FROM (VALUES ${Prisma.join(values)}) AS v(product_id, delta)
    WHERE w."productId" = v.product_id
      AND w."warehouseId" = ${warehouseId}
      AND w.quantity + v.delta >= 0`;

  if (updated !== deltas.length) {
    throw new Error(
      "Stoc insuficient în locația selectată pentru cel puțin un produs (modificat între timp).",
    );
  }
}

/** Recalculează `Product.stock` pentru toate produsele atinse, într-un singur UPDATE. */
export async function syncProductAggregateStocks(
  tx: Prisma.TransactionClient,
  productIds: string[],
) {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return;

  await tx.$executeRaw`
    UPDATE "Product" p
    SET stock = COALESCE(s.total, 0), "manuallyEdited" = true, "updatedAt" = now()
    FROM (
      SELECT pr.id AS product_id,
             (SELECT COALESCE(SUM(w.quantity), 0)::int
                FROM "WarehouseStock" w WHERE w."productId" = pr.id) AS total
        FROM "Product" pr
       WHERE pr.id IN (${Prisma.join(unique)})
    ) s
    WHERE p.id = s.product_id`;
}
