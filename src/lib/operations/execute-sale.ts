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
import { ensureCustomerPartner } from "@/lib/operations/supplier-selection";
import type { PendingSalePayload } from "@/lib/pending-operations/types";
import { prisma } from "@/lib/prisma";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";

const RESTOCK_WAREHOUSE_NAME = "Pavilion 110A";

type SaleValidationClient = typeof prisma | Prisma.TransactionClient;

export function saleTotalLei(payload: PendingSalePayload) {
  return payload.lines.reduce(
    (total, line) => total + line.quantity * line.unitPriceLei,
    0,
  );
}

export function saleRequestSummary(
  payload: PendingSalePayload,
  warehouseName: string,
) {
  const cashStatus = payload.cashRegistered
    ? "bătută în casă"
    : "nebătută în casă";
  return `Cerere vânzare (${payload.lines.length} produse, ${saleTotalLei(payload)} lei, ${cashStatus}, plată ${salePaymentMethodLabel(payload.paymentMethod)}) — ${warehouseName}`;
}

export async function validateSaleRequest(
  client: SaleValidationClient,
  payload: PendingSalePayload,
) {
  const [warehouse, partner, products] = await Promise.all([
    client.warehouse.findFirst({
      where: { id: payload.warehouseId, active: true },
      select: { id: true, name: true },
    }),
    payload.partnerId
      ? client.partner.findUnique({
          where: { id: payload.partnerId },
          select: { id: true, kind: true },
        })
      : Promise.resolve(null),
    client.product.findMany({
      where: {
        id: {
          in: payload.lines.flatMap((line) =>
            line.productId ? [line.productId] : [],
          ),
        },
      },
      select: {
        id: true,
        stock: true,
        externalCode: true,
        description: true,
        warehouseStocks: {
          select: { warehouseId: true, quantity: true },
        },
      },
    }),
  ]);

  if (!warehouse) {
    throw new Error("Locația aleasă nu există sau este dezactivată.");
  }
  if (payload.partnerId) {
    ensureCustomerPartner(partner, payload.partnerId);
  }
  // Liniile externe (piese de la furnizori, în afara catalogului) nu au
  // produs și nu se validează pe stoc.
  const catalogLines = payload.lines.filter(
    (line): line is typeof line & { productId: string } => line.productId != null,
  );
  if (products.length !== catalogLines.length) {
    throw new Error("Unul dintre produsele selectate nu mai există.");
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  for (const line of catalogLines) {
    const product = productById.get(line.productId)!;
    const selectedStock = product.warehouseStocks.find(
      (stock) => stock.warehouseId === payload.warehouseId,
    );
    const available =
      selectedStock?.quantity ??
      (product.warehouseStocks.length === 0 ? product.stock ?? 0 : 0);
    validateSaleAvailability(
      available,
      line.quantity,
      product.externalCode ?? product.description,
    );
  }

  return warehouse;
}

export async function executeSale(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  payload: PendingSalePayload,
) {
  const warehouse = await validateSaleRequest(tx, payload);
  const partnerId = await resolveCustomer(tx, payload);
  const documentDate = new Date(`${payload.documentDate}T12:00:00`);
  const lines = payload.lines.map((line) => ({
    productId: line.productId,
    externalName: line.externalName ?? null,
    externalCode: line.externalCode ?? null,
    externalSupplierId: line.externalSupplierId ?? null,
    unitCostLei: line.unitCostLei ?? null,
    quantity: line.quantity,
    unitPriceEuro: line.unitPriceLei,
  }));
  // Liniile externe nu ating stocul/catalogul — doar liniile de catalog.
  const catalogLines = lines.filter(
    (line): line is typeof line & { productId: string } => line.productId != null,
  );

  for (const line of catalogLines) {
    await ensureWarehouseStockRow(tx, line.productId, payload.warehouseId);
  }

  const document = await tx.stockDocument.create({
    data: {
      type: "SALE",
      number: await nextStockDocumentNumber(tx, "SALE"),
      documentDate,
      warehouseId: payload.warehouseId,
      partnerId,
      notes: payload.notes,
      cashRegistered: payload.cashRegistered,
      paymentMethod: payload.paymentMethod,
      totalLei: saleTotalLei(payload),
      lines: { create: lines },
    },
  });

  if (warehouse.name === RESTOCK_WAREHOUSE_NAME) {
    await tx.restockTask.createMany({
      data: aggregateRestockRequests(catalogLines).map((line) => ({
        productId: line.productId,
        warehouseId: payload.warehouseId,
        sourceDocumentId: document.id,
        quantity: line.quantity,
        requestedAt: documentDate,
      })),
    });
  }

  for (const line of catalogLines) {
    await decrementWarehouseStock(
      tx,
      line.productId,
      payload.warehouseId,
      line.quantity,
    );
    await syncProductAggregateStock(tx, line.productId);
  }

  await logAuditRequired(tx, actor, {
    action: "CREATE",
    entity: "StockDocument",
    entityId: document.id,
    summary: `Vânzare #${document.number} creată (${lines.length} produse, ${saleTotalLei(payload)} lei) — ${warehouse.name}`,
    details: {
      lines,
      cashRegistered: payload.cashRegistered,
      paymentMethod: payload.paymentMethod,
    },
  });

  return { id: document.id, number: document.number };
}

async function resolveCustomer(
  tx: Prisma.TransactionClient,
  payload: PendingSalePayload,
) {
  if (payload.newCustomerName) {
    const existing = await tx.partner.findUnique({
      where: { name: payload.newCustomerName },
      select: { id: true, kind: true },
    });
    if (existing) {
      if (existing.kind === "SUPPLIER") {
        await tx.partner.update({
          where: { id: existing.id },
          data: { kind: "BOTH" },
        });
      }
      return existing.id;
    }
    const created = await tx.partner.create({
      data: { name: payload.newCustomerName, kind: "CUSTOMER" },
      select: { id: true },
    });
    return created.id;
  }

  const partner = payload.partnerId
    ? await tx.partner.findUnique({
        where: { id: payload.partnerId },
        select: { id: true, kind: true },
      })
    : null;
  return ensureCustomerPartner(partner, payload.partnerId);
}
