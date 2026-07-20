import { prisma } from "@/lib/prisma";
import type { ExternalOrderStatus } from "@/generated/prisma/enums";

/** Statusurile finale nu mai apar în lista activă, doar în arhivă. */
export const FINAL_STATUSES: readonly ExternalOrderStatus[] = ["LIVRAT", "ANULAT"];

export type ExternalOrderRow = {
  id: string;
  number: number;
  status: ExternalOrderStatus;
  customerName: string;
  customerPhone: string | null;
  productName: string;
  productCode: string | null;
  quantity: number;
  supplierId: string | null;
  supplierName: string | null;
  supplierPriceLei: number | null;
  salePriceLei: number | null;
  offerValidUntil: Date | null;
  notes: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
};

export type ExternalOrdersData = {
  active: ExternalOrderRow[];
  archive: ExternalOrderRow[];
  suppliers: { id: string; name: string }[];
};

export async function getExternalOrdersData(): Promise<ExternalOrdersData> {
  const [orders, suppliers] = await Promise.all([
    prisma.externalOrder.findMany({
      include: { supplier: { select: { name: true } } },
      orderBy: { number: "desc" },
      take: 300,
    }),
    prisma.partner.findMany({
      where: { kind: { in: ["SUPPLIER", "BOTH"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: ExternalOrderRow[] = orders.map((order) => ({
    id: order.id,
    number: order.number,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    productName: order.productName,
    productCode: order.productCode,
    quantity: order.quantity,
    supplierId: order.supplierId,
    supplierName: order.supplier?.name ?? null,
    supplierPriceLei: order.supplierPriceLei != null ? Number(order.supplierPriceLei) : null,
    salePriceLei: order.salePriceLei != null ? Number(order.salePriceLei) : null,
    offerValidUntil: order.offerValidUntil,
    notes: order.notes,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
  }));

  return {
    active: rows.filter((row) => !FINAL_STATUSES.includes(row.status)),
    archive: rows.filter((row) => FINAL_STATUSES.includes(row.status)),
    suppliers,
  };
}
