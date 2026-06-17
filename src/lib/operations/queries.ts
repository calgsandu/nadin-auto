import { prisma } from "@/lib/prisma";
import { aggregateSoldProducts } from "@/lib/operations/sales";

export async function getOperationsData() {
  await ensureDefaultWarehouses();
  const today = getTodayRange();

  const [warehouses, recentDocuments, salesToday] = await Promise.all([
    prisma.warehouse.findMany({
      where: { active: true },
      include: {
        stocks: {
          select: {
            quantity: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.stockDocument.findMany({
      where: {
        type: {
          in: ["RECEIPT", "ADJUSTMENT", "SALE"],
        },
      },
      include: {
        warehouse: true,
        partner: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
      orderBy: [{ documentDate: "desc" }, { number: "desc" }],
      take: 12,
    }),
    prisma.stockDocument.findMany({
      where: {
        type: "SALE",
        documentDate: {
          gte: today.start,
          lt: today.end,
        },
      },
      include: {
        warehouse: true,
        partner: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
      orderBy: [{ documentDate: "desc" }, { number: "desc" }],
    }),
  ]);

  const salesFrom110AToday = salesToday.filter(
    (sale) => sale.warehouse.name === "Pavilion 110A",
  );
  const soldToday = aggregateSoldProducts(
    salesFrom110AToday.flatMap((sale) => sale.lines),
  );
  const soldProductById = new Map(
    salesFrom110AToday
      .flatMap((sale) => sale.lines)
      .map((line) => [line.productId, line.product]),
  );

  return {
    warehouses,
    recentDocuments,
    salesToday,
    soldToday: soldToday.map((line) => ({
      ...line,
      product: soldProductById.get(line.productId)!,
    })),
  };
}

async function ensureDefaultWarehouses() {
  const existingDefault = await prisma.warehouse.findFirst({
    where: { isDefault: true },
  });

  await prisma.warehouse.upsert({
    where: { name: "Depozit principal" },
    create: {
      name: "Depozit principal",
      isDefault: true,
    },
    update: existingDefault
      ? {}
      : {
          isDefault: true,
        },
  });

  await Promise.all(
    ["Pavilion 110A", "Pavilion 514", "Marfă în tranzit"].map((name) =>
      prisma.warehouse.upsert({
        where: { name },
        create: { name },
        update: {},
      }),
    ),
  );
}

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
