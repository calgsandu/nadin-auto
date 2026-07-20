import type { Prisma } from "@/generated/prisma/client";
import {
  logAuditRequired,
  type AuditActor,
} from "@/lib/audit";
import { validateSaleAvailability } from "@/lib/operations/inventory";
import { aggregateRestockRequests } from "@/lib/operations/restock";
import {
  decrementWarehouseStock,
  ensureWarehouseStockRow,
  nextStockDocumentNumber,
  syncProductAggregateStock,
} from "@/lib/operations/stock-mutations";
import { buildPaymentAccountSaleData } from "@/lib/payment-accounts/fulfill";
import { prisma } from "@/lib/prisma";

type FulfillmentValidationClient = typeof prisma | Prisma.TransactionClient;

export function fulfillmentRequestSummary(account: {
  number: number;
  customerName: string;
  totalGross: number;
}) {
  return `Cerere predare cont #${account.number} — ${account.customerName} (${account.totalGross} lei)`;
}

export function assertFulfillmentWarehouseActive(active: boolean) {
  if (!active) {
    throw new Error("Locația contului de plată este dezactivată.");
  }
}

export async function validatePaymentFulfillmentRequest(
  client: FulfillmentValidationClient,
  accountId: string,
) {
  const account = await client.paymentAccount.findUnique({
    where: { id: accountId },
    include: {
      lines: true,
      warehouse: { select: { id: true, name: true, active: true } },
    },
  });
  if (!account) throw new Error("Contul de plată nu există.");
  assertFulfillmentWarehouseActive(account.warehouse.active);

  const saleData = buildPaymentAccountSaleData(
    {
      id: account.id,
      number: account.number,
      warehouseId: account.warehouseId,
      partnerId: account.partnerId,
      cancelledAt: account.cancelledAt,
      fulfilledAt: account.fulfilledAt,
      totalGross: Number(account.totalGross),
      notes: account.notes,
      lines: account.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPriceGross: Number(line.unitPriceGross),
      })),
    },
    new Date(),
  );

  const products = await client.product.findMany({
    where: { id: { in: saleData.lines.map((line) => line.productId) } },
    select: {
      id: true,
      stock: true,
      warehouseStocks: {
        select: { warehouseId: true, quantity: true },
      },
    },
  });
  if (products.length !== saleData.lines.length) {
    throw new Error("Unul dintre produsele contului nu mai există.");
  }
  const productById = new Map(products.map((product) => [product.id, product]));
  for (const line of saleData.lines) {
    const product = productById.get(line.productId)!;
    const selectedStock = product.warehouseStocks.find(
      (stock) => stock.warehouseId === account.warehouseId,
    );
    const available =
      selectedStock?.quantity ??
      (product.warehouseStocks.length === 0 ? product.stock ?? 0 : 0);
    validateSaleAvailability(available, line.quantity);
  }

  return account;
}

export async function executePaymentAccountFulfillment(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  accountId: string,
) {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "PaymentAccount" WHERE id = ${accountId} FOR UPDATE`;
  if (locked.length === 0) throw new Error("Contul de plată nu există.");

  const account = await tx.paymentAccount.findUnique({
    where: { id: accountId },
    include: {
      lines: true,
      warehouse: { select: { name: true, active: true } },
    },
  });
  if (!account) throw new Error("Contul de plată nu există.");
  assertFulfillmentWarehouseActive(account.warehouse.active);

  const now = new Date();
  const saleData = buildPaymentAccountSaleData(
    {
      id: account.id,
      number: account.number,
      warehouseId: account.warehouseId,
      partnerId: account.partnerId,
      cancelledAt: account.cancelledAt,
      fulfilledAt: account.fulfilledAt,
      totalGross: Number(account.totalGross),
      notes: account.notes,
      lines: account.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPriceGross: Number(line.unitPriceGross),
      })),
    },
    now,
  );

  for (const line of saleData.lines) {
    const stock = await ensureWarehouseStockRow(
      tx,
      line.productId,
      saleData.warehouseId,
    );
    validateSaleAvailability(stock.quantity, line.quantity);
  }

  const sale = await tx.stockDocument.create({
    data: {
      ...saleData,
      number: await nextStockDocumentNumber(tx, "SALE"),
      lines: { create: saleData.lines },
    },
  });

  if (account.warehouse.name === "Pavilion 110A") {
    await tx.restockTask.createMany({
      data: aggregateRestockRequests(saleData.lines).map((line) => ({
        productId: line.productId,
        warehouseId: account.warehouseId,
        sourceDocumentId: sale.id,
        quantity: line.quantity,
        requestedAt: now,
      })),
    });
  }

  for (const line of saleData.lines) {
    await decrementWarehouseStock(
      tx,
      line.productId,
      account.warehouseId,
      line.quantity,
    );
    await syncProductAggregateStock(tx, line.productId);
  }

  await tx.paymentAccount.update({
    where: { id: accountId },
    data: { fulfilledAt: now, saleDocumentId: sale.id },
  });
  await logAuditRequired(tx, actor, {
    action: "CREATE",
    entity: "StockDocument",
    entityId: sale.id,
    summary: `Vânzare #${sale.number} creată din contul de plată #${account.number}`,
  });

  return {
    appliedEntityId: sale.id,
    accountNumber: account.number,
    saleNumber: sale.number,
  };
}
