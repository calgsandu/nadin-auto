import { prisma } from "@/lib/prisma";
import { productLabelInclude } from "@/lib/catalog/product-include";
import { getPartnerBalances } from "@/lib/partners/debt";
import type { VehicleFitmentInfo } from "@/lib/catalog/vehicle-label";
import {
  aggregateRestockRequests,
  splitRestockTasksByStatus,
} from "@/lib/operations/restock";
import {
  INVENTORY_PAGE_SIZE,
  inventoryDocumentWhere,
  inventoryWhere,
  normalizeInventoryPage,
} from "@/lib/operations/inventory-filter";

/** Câte documente arată o secțiune de operațiuni (filtrele complete sunt în Documente). */
const SECTION_DOCUMENT_LIMIT = 50;

/** Ce încarcă fiecare secțiune de operațiuni — restul rămâne gol. */
const SECTION_NEEDS = {
  receptii: { warehouses: true, suppliers: true, receipts: true },
  transferuri: { warehouses: true, suppliers: true, transfers: true },
  vanzari: { warehouses: true, suppliers: true, customers: true },
  retururi: { returns: true, salesArchive: true },
  "de-adus": { warehouses: true, restock: true },
  "fara-stoc": { restock: true },
} as const satisfies Record<string, Partial<Record<OperationsNeed, true>>>;

type OperationsNeed =
  | "warehouses"
  | "suppliers"
  | "customers"
  | "receipts"
  | "transferuri"
  | "transfers"
  | "returns"
  | "salesArchive"
  | "restock";

export type OperationsSection = keyof typeof SECTION_NEEDS;

const documentInclude = {
  warehouse: true,
  partner: true,
  lines: { include: { product: { include: productLabelInclude } } },
} as const;

const documentOrder = [
  { documentDate: "desc" },
  { number: "desc" },
] as const;

/**
 * Datele unei secțiuni de operațiuni.
 *
 * Forma returnată e aceeași pentru toate secțiunile (ca UI-ul să nu se schimbe),
 * dar se interoghează DOAR ce afișează secțiunea cerută: înainte fiecare dintre
 * cele șase secțiuni aducea toate cele opt seturi de date (~1 s, din care
 * majoritatea nefolosite).
 */
export async function getOperationsData(section: OperationsSection = "receptii") {
  const needs: Partial<Record<OperationsNeed, true>> = SECTION_NEEDS[section];

  const [warehouses, receipts, transfers, salesArchive, returns, suppliers, customers] =
    await Promise.all([
      // Doar id + nume: secțiunile folosesc depozitele ca opțiuni de dialog,
      // iar `stocks` însemna 2.900 de rânduri aduse degeaba la fiecare afișare.
      needs.warehouses || needs.restock
        ? prisma.warehouse.findMany({
            where: { active: true },
            select: { id: true, name: true, isDefault: true, active: true },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
      needs.receipts
        ? prisma.stockDocument.findMany({
            where: { type: "RECEIPT" },
            include: documentInclude,
            orderBy: [...documentOrder],
            take: SECTION_DOCUMENT_LIMIT,
          })
        : Promise.resolve([]),
      // Transferurile sunt tot ADJUSTMENT — se exclud inventarele, care au
      // secțiunea lor. Ajustările vechi fără transferGroupId rămân aici, ca să
      // nu dispară din aplicație.
      needs.transfers
        ? prisma.stockDocument.findMany({
            where: { type: "ADJUSTMENT", NOT: inventoryDocumentWhere() },
            include: documentInclude,
            orderBy: [...documentOrder],
            take: SECTION_DOCUMENT_LIMIT,
          })
        : Promise.resolve([]),
      // Dialogul de retur oferă ultimele 30 de vânzări — atât se și aduc.
      needs.salesArchive
        ? prisma.stockDocument.findMany({
            where: { type: "SALE" },
            include: documentInclude,
            orderBy: [...documentOrder],
            take: 30,
          })
        : Promise.resolve([]),
      needs.returns
        ? prisma.stockDocument.findMany({
            where: { type: "RETURN" },
            include: documentInclude,
            orderBy: [...documentOrder],
            take: SECTION_DOCUMENT_LIMIT,
          })
        : Promise.resolve([]),
      needs.suppliers
        ? prisma.partner.findMany({
            where: { kind: { in: ["SUPPLIER", "BOTH"] } },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      needs.customers
        ? prisma.partner.findMany({
            where: { kind: { in: ["CUSTOMER", "BOTH"] } },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

  // Datoria clientului („Долг") se arată la alegerea lui în dialogul de vânzare.
  const balances = needs.customers ? await getPartnerBalances() : new Map<string, number>();
  const customersWithBalance = customers.map((customer) => ({
    ...customer,
    balanceLei: balances.get(customer.id) ?? 0,
  }));

  const restockWarehouse = warehouses.find(
    (warehouse) => warehouse.name === "Pavilion 110A",
  );
  const restockTasks =
    needs.restock && restockWarehouse
      ? await prisma.restockTask.findMany({
          where: {
            warehouseId: restockWarehouse.id,
            OR: [
              { status: { in: ["PENDING", "UNAVAILABLE"] } },
              // Aduse azi: confirmarea că poziția a plecat din listă pentru că
              // s-a rezolvat, nu pentru că a dispărut.
              { status: "DELIVERED", resolvedAt: { gte: startOfToday() } },
            ],
          },
          include: { product: { include: productLabelInclude } },
          orderBy: [{ requestedAt: "asc" }, { createdAt: "asc" }],
        })
      : [];
  const restockByStatus = splitRestockTasksByStatus(restockTasks);

  return {
    warehouses,
    receipts,
    transfers,
    salesArchive,
    restockPending: summarizeRestockTasks(restockByStatus.pending),
    restockUnavailable: summarizeRestockTasks(restockByStatus.unavailable),
    restockDeliveredToday: summarizeRestockTasks(restockByStatus.delivered),
    suppliers,
    customers: customersWithBalance,
    returns,
  };
}

export type OperationsData = Awaited<ReturnType<typeof getOperationsData>>;

/** Stock rows for one warehouse (inventory check) + inventarele trecute, filtrate pe perioadă. */
export async function getInventoryData(params: {
  wh?: string;
  from?: string;
  to?: string;
  ipage?: string;
} = {}) {
  const warehouses = await listActiveWarehouses();
  const selected =
    warehouses.find((warehouse) => warehouse.id === params.wh) ??
    warehouses.find((warehouse) => warehouse.name === "Pavilion 110A") ??
    warehouses[0] ??
    null;

  const page = normalizeInventoryPage(params.ipage);
  const where = selected
    ? inventoryWhere({ warehouseId: selected.id, from: params.from, to: params.to })
    : null;

  // Stocul și arhiva nu depind unul de altul — un singur dus-întors, nu trei.
  const [stocks, operations, total] = await Promise.all([
    selected
      ? prisma.warehouseStock.findMany({
          where: { warehouseId: selected.id, quantity: { not: 0 } },
          include: {
            product: {
              select: {
                externalCode: true,
                description: true,
                salePriceLei: true,
                fitment: { include: { carModel: { include: { brand: true } } } },
                productFitments: {
                  select: { fitment: { include: { carModel: { include: { brand: true } } } } },
                },
              },
            },
          },
          orderBy: { product: { description: "asc" } },
        })
      : Promise.resolve([]),
    where
      ? prisma.stockDocument.findMany({
          where,
          include: {
            warehouse: { select: { name: true } },
            partner: { select: { id: true, name: true, phone: true } },
            lines: {
              include: {
                product: {
                  select: {
                    description: true,
                    externalCode: true,
                    type: { select: { name: true } },
                    fitment: { include: { carModel: { include: { brand: true } } } },
                    productFitments: {
                      select: { fitment: { include: { carModel: { include: { brand: true } } } } },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ documentDate: "desc" }, { number: "desc" }],
          skip: (page - 1) * INVENTORY_PAGE_SIZE,
          take: INVENTORY_PAGE_SIZE,
        })
      : Promise.resolve([]),
    where ? prisma.stockDocument.count({ where }) : Promise.resolve(0),
  ]);

  return {
    warehouses,
    selected,
    stocks,
    operations,
    total,
    page,
    pageSize: INVENTORY_PAGE_SIZE,
    pageCount: Math.max(Math.ceil(total / INVENTORY_PAGE_SIZE), 1),
    filters: { from: params.from ?? "", to: params.to ?? "" },
  };
}

export type InventoryData = Awaited<ReturnType<typeof getInventoryData>>;

function summarizeRestockTasks<
  T extends {
    productId: string;
    warehouseId: string;
    quantity: number;
    requestedAt: Date;
    product: {
      externalCode: string | null;
      description: string;
      type?: { name: string } | null;
      fitment: VehicleFitmentInfo;
    };
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

const DEFAULT_WAREHOUSE_NAMES = [
  "Depozit principal",
  "Pavilion 110A",
  "Pavilion 514",
  "Marfă în tranzit",
];

/**
 * Depozitele active, semănându-le pe cele implicite doar dacă lipsesc.
 *
 * Înainte, fiecare afișare de operațiuni/inventar făcea un findFirst + patru
 * upsert-uri „pentru orice eventualitate" — cinci dus-întorsuri irosite la
 * fiecare încărcare de pagină. Verificarea se face acum pe lista deja citită.
 */
async function listActiveWarehouses() {
  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  const complete =
    warehouses.some((warehouse) => warehouse.isDefault) &&
    DEFAULT_WAREHOUSE_NAMES.every((name) =>
      warehouses.some((warehouse) => warehouse.name === name),
    );
  if (complete) return warehouses;

  await seedDefaultWarehouses(warehouses.some((warehouse) => warehouse.isDefault));
  return prisma.warehouse.findMany({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

async function seedDefaultWarehouses(hasDefault: boolean) {
  await prisma.warehouse.upsert({
    where: { name: "Depozit principal" },
    create: { name: "Depozit principal", isDefault: true },
    update: hasDefault ? {} : { isDefault: true },
  });
  await Promise.all(
    DEFAULT_WAREHOUSE_NAMES.slice(1).map((name) =>
      prisma.warehouse.upsert({ where: { name }, create: { name }, update: {} }),
    ),
  );
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
            product: { include: productLabelInclude },
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

function startOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}
