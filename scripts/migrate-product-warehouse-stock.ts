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
    const products = await tx.product.findMany({
      select: {
        id: true,
        stock: true,
        warehouseStocks: {
          select: { warehouseId: true, quantity: true },
        },
      },
    });

    let migrated = 0;
    let synchronized = 0;

    for (const product of products) {
      const plan = planProductWarehouseMigration({
        productId: product.id,
        legacyStock: product.stock ?? 0,
        existingRows: product.warehouseStocks,
        warehouse110AId: warehouse110A.id,
      });

      if (plan.create110AQuantity !== null) {
        await tx.warehouseStock.create({
          data: {
            productId: product.id,
            warehouseId: warehouse110A.id,
            quantity: plan.create110AQuantity,
          },
        });
        migrated += 1;
      }

      if (product.stock !== plan.totalQuantity) {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: plan.totalQuantity },
        });
        synchronized += 1;
      }
    }

    return { migrated, synchronized, products: products.length };
  });

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
