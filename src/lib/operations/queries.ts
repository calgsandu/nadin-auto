import { prisma } from "@/lib/prisma";
import type { VehicleFitmentInfo } from "@/lib/catalog/vehicle-label";
import { aggregateSoldProducts } from "@/lib/operations/sales";
import {
  aggregateRestockRequests,
  splitRestockTasksByStatus,
} from "@/lib/operations/restock";

export async function getOperationsData() {
  await ensureDefaultWarehouses();
  const today = getTodayRange();

  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    include: {
      stocks: {
        select: {
          quantity: true,
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  const restockWarehouse = warehouses.find((warehouse) => warehouse.name === "Pavilion 110A");

  // Arhiva detaliată (cu linii) se limitează la 90 de zile; totalurile pe
  // lună/an vin din SQL ca aplicația să nu încarce toate vânzările istorice.
  const archiveSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    recentDocuments,
    salesToday,
    salesArchive,
    returns,
    restockTasks,
    suppliers,
    customers,
  ] = await Promise.all([
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
            product: { include: { fitment: { include: { carModel: { include: { brand: true } } } } } },
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
            product: { include: { fitment: { include: { carModel: { include: { brand: true } } } } } },
          },
        },
      },
      orderBy: [{ documentDate: "desc" }, { number: "desc" }],
    }),
    prisma.stockDocument.findMany({
      where: {
        type: "SALE",
        documentDate: { gte: archiveSince },
      },
      include: {
        warehouse: true,
        partner: true,
        lines: {
          include: {
            product: { include: { fitment: { include: { carModel: { include: { brand: true } } } } } },
          },
        },
      },
      orderBy: [{ documentDate: "desc" }, { number: "desc" }],
    }),
    prisma.stockDocument.findMany({
      where: { type: "RETURN" },
      include: {
        warehouse: true,
        partner: true,
        lines: { include: { product: { include: { fitment: { include: { carModel: { include: { brand: true } } } } } } } },
      },
      orderBy: [{ documentDate: "desc" }, { number: "desc" }],
      take: 50,
    }),
    restockWarehouse
      ? prisma.restockTask.findMany({
          where: {
            warehouseId: restockWarehouse.id,
            status: {
              in: ["PENDING", "UNAVAILABLE"],
            },
          },
          include: {
            product: { include: { fitment: { include: { carModel: { include: { brand: true } } } } } },
          },
          orderBy: [{ requestedAt: "asc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
    prisma.partner.findMany({
      where: { kind: { in: ["SUPPLIER", "BOTH"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.partner.findMany({
      where: { kind: { in: ["CUSTOMER", "BOTH"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const salesFrom110AToday = salesToday.filter(
    (sale) => sale.warehouse.name === "Pavilion 110A",
  );
  // „De adus" numără doar liniile de catalog — cele externe n-au stoc de refăcut.
  const catalogLinesToday = salesFrom110AToday
    .flatMap((sale) => sale.lines)
    .filter(
      (line): line is typeof line & { productId: string } => line.productId != null,
    );
  const soldToday = aggregateSoldProducts(catalogLinesToday);
  const soldProductById = new Map(
    catalogLinesToday.map((line) => [line.productId, line.product]),
  );
  const restockByStatus = splitRestockTasksByStatus(restockTasks);

  return {
    warehouses,
    recentDocuments,
    salesToday,
    salesArchive,
    soldToday: soldToday.map((line) => ({
      ...line,
      product: soldProductById.get(line.productId)!,
    })),
    restockPending: summarizeRestockTasks(restockByStatus.pending),
    restockUnavailable: summarizeRestockTasks(restockByStatus.unavailable),
    suppliers,
    customers,
    returns,
  };
}

/** Stock rows for one warehouse (inventory check). */
export async function getInventoryData(warehouseParam?: string) {
  await ensureDefaultWarehouses();

  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  const selected =
    warehouses.find((warehouse) => warehouse.id === warehouseParam) ??
    warehouses.find((warehouse) => warehouse.name === "Pavilion 110A") ??
    warehouses[0] ??
    null;

  const stocks = selected
    ? await prisma.warehouseStock.findMany({
        where: { warehouseId: selected.id, quantity: { not: 0 } },
        include: {
          product: {
            select: {
              externalCode: true,
              description: true,
              salePriceLei: true,
              fitment: { include: { carModel: { include: { brand: true } } } },
            },
          },
        },
        orderBy: { product: { description: "asc" } },
      })
    : [];

  return { warehouses, selected, stocks };
}

export type InventoryData = Awaited<ReturnType<typeof getInventoryData>>;

function summarizeRestockTasks<
  T extends {
    productId: string;
    warehouseId: string;
    quantity: number;
    requestedAt: Date;
    product: { externalCode: string | null; description: string; fitment: VehicleFitmentInfo };
  },
>(tasks: T[]) {
  const productById = new Map(tasks.map((task) => [task.productId, task.product]));
  const tasksByProduct = new Map<string, T[]>();

  for (const task of tasks) {
    tasksByProduct.set(task.productId, [
      ...(tasksByProduct.get(task.productId) ?? []),
      task,
    ]);
  }

  return aggregateRestockRequests(tasks).map((line) => {
    const productTasks = tasksByProduct.get(line.productId) ?? [];
    const timestamps = productTasks.map((task) => task.requestedAt.getTime());

    return {
      productId: line.productId,
      warehouseId: productTasks[0]?.warehouseId ?? "",
      quantity: line.quantity,
      taskCount: productTasks.length,
      oldestRequestedAt: new Date(Math.min(...timestamps)),
      latestRequestedAt: new Date(Math.max(...timestamps)),
      product: productById.get(line.productId)!,
    };
  });
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

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Vânzările unei zile (implicit azi) + totalul lunii din care face parte ziua. */
export async function getSalesDayData(dayParam?: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dayParam ?? "")
    ? new Date(`${dayParam}T00:00:00`)
    : null;
  const start = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);

  const [sales, monthTotals] = await Promise.all([
    prisma.stockDocument.findMany({
      where: {
        type: "SALE",
        documentDate: { gte: start, lt: end },
      },
      include: {
        warehouse: true,
        partner: true,
        lines: {
          include: {
            product: { include: { fitment: { include: { carModel: { include: { brand: true } } } } } },
          },
        },
      },
      orderBy: [{ documentDate: "desc" }, { number: "desc" }],
    }),
    prisma.$queryRaw<{ cnt: number; total: number }[]>`
      SELECT COUNT(*)::int AS cnt,
             COALESCE(SUM(COALESCE("totalLei", "totalEuro")), 0)::float AS total
      FROM "StockDocument"
      WHERE type = 'SALE'
        AND "documentDate" >= ${monthStart}
        AND "documentDate" < ${monthEnd}`,
  ]);

  return {
    dayKey: localDayKey(start),
    sales,
    monthCount: monthTotals[0]?.cnt ?? 0,
    monthLei: monthTotals[0]?.total ?? 0,
  };
}

export type SalesDayData = Awaited<ReturnType<typeof getSalesDayData>>;
