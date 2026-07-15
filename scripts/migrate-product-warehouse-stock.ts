import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { planProductWarehouseMigration } from "../src/lib/catalog/warehouse-stock-migration";

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const warehouse110A = await tx.warehouse.upsert({
      where: { name: "Pavilion 110A" },
      create: { name: "Pavilion 110A" },
      update: {},
      select: { id: true },
    });
    const legacyProducts = await tx.product.findMany({
      where: { warehouseStocks: { none: {} } },
      select: { id: true, stock: true },
    });

    const migrated = legacyProducts.length > 0
      ? await tx.warehouseStock.createMany({
          data: legacyProducts.map((product) => ({
            productId: product.id,
            warehouseId: warehouse110A.id,
            quantity: Math.max(0, product.stock ?? 0),
          })),
          skipDuplicates: true,
        })
      : { count: 0 };

    const synchronized = await tx.$executeRaw`
      UPDATE "Product" AS p
      SET "stock" = COALESCE(
        (SELECT SUM(ws."quantity")::int FROM "WarehouseStock" AS ws WHERE ws."productId" = p."id"),
        0
      )
      WHERE p."stock" IS DISTINCT FROM COALESCE(
        (SELECT SUM(ws."quantity")::int FROM "WarehouseStock" AS ws WHERE ws."productId" = p."id"),
        0
      )`;

    const products = await tx.product.count();

    return { migrated: migrated.count, synchronized, products };
  }, { maxWait: 10000, timeout: 120000 });

  console.log(
    `Stocuri migrate în Pavilion 110A: ${result.migrated}; totaluri sincronizate: ${result.synchronized}; produse verificate: ${result.products}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
