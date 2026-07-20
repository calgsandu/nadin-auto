import { prisma } from "@/lib/prisma";
import { pendingSaleCustomerName } from "@/lib/pending-operations/display";
import { parsePendingOperationPayload } from "@/lib/pending-operations/payload";
import { vehicleLabel } from "@/lib/catalog/vehicle-label";

export type AuditSearchParams = {
  /** Filtrează după document (entityId). */
  doc?: string;
  /** Filtrează după acțiune: CREATE / UPDATE / DELETE. */
  act?: string;
};

const ACTIONS = new Set(["CREATE", "UPDATE", "DELETE"]);

/** Ultimele intrări din jurnalul de audit, cele mai noi primele. */
export async function getAuditData(params: AuditSearchParams = {}) {
  const action = params.act && ACTIONS.has(params.act) ? (params.act as "CREATE" | "UPDATE" | "DELETE") : undefined;

  const entries = await prisma.auditLog.findMany({
    where: {
      ...(params.doc ? { entityId: params.doc } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { entries, filters: { doc: params.doc, act: action } };
}

export type AuditData = Awaited<ReturnType<typeof getAuditData>>;
export type AuditRow = AuditData["entries"][number];

/** Câte cereri de stoc așteaptă decizia directorului (badge nav). */
export function getPendingApprovalCount() {
  return prisma.pendingOperation.count({ where: { status: "PENDING" } });
}

/** Cereri în așteptare și ultimele decizii, cu detalii lizibile pentru UI. */
export async function getApprovalsData() {
  const [pendingRows, rejectedRows, approvedRows] = await Promise.all([
    prisma.pendingOperation.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.pendingOperation.findMany({
      where: { status: "REJECTED" },
      orderBy: { reviewedAt: "desc" },
      take: 100,
    }),
    prisma.pendingOperation.findMany({
      where: { status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      take: 100,
    }),
  ]);

  const allRows = [...pendingRows, ...rejectedRows, ...approvedRows];
  const parsed = allRows.map((row) => ({
    row,
    operation: parsePendingOperationPayload(row.kind, row.payload),
  }));

  const warehouseIds = new Set<string>();
  const partnerIds = new Set<string>();
  const productIds = new Set<string>();
  const accountIds = new Set<string>();
  for (const entry of parsed) {
    if (entry.operation.kind === "SALE") {
      warehouseIds.add(entry.operation.payload.warehouseId);
      if (entry.operation.payload.partnerId) {
        partnerIds.add(entry.operation.payload.partnerId);
      }
      for (const line of entry.operation.payload.lines) {
        if (line.productId) productIds.add(line.productId);
      }
    } else {
      accountIds.add(entry.operation.payload.paymentAccountId);
    }
  }

  const [warehouses, partners, products, accounts] = await Promise.all([
    prisma.warehouse.findMany({
      where: { id: { in: [...warehouseIds] } },
      select: { id: true, name: true },
    }),
    prisma.partner.findMany({
      where: { id: { in: [...partnerIds] } },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { id: { in: [...productIds] } },
      select: {
        id: true,
        externalCode: true,
        description: true,
        fitment: { include: { carModel: { include: { brand: true } } } },
      },
    }),
    prisma.paymentAccount.findMany({
      where: { id: { in: [...accountIds] } },
      select: {
        id: true,
        number: true,
        customerName: true,
        totalGross: true,
        warehouse: { select: { name: true } },
        lines: {
          select: {
            productId: true,
            productCode: true,
            description: true,
            quantity: true,
            unitPriceGross: true,
            product: {
              select: { fitment: { include: { carModel: { include: { brand: true } } } } },
            },
          },
        },
      },
    }),
  ]);

  const warehouseById = new Map(warehouses.map((row) => [row.id, row.name]));
  const partnerById = new Map(partners.map((row) => [row.id, row.name]));
  const productById = new Map(products.map((row) => [row.id, row]));
  const accountById = new Map(accounts.map((row) => [row.id, row]));

  const hydrated = parsed.map(({ row, operation }) => {
    if (operation.kind === "SALE") {
      const payload = operation.payload;
      return {
        ...row,
        details: {
          kind: "SALE" as const,
          warehouseName:
            warehouseById.get(payload.warehouseId) ?? "Locație indisponibilă",
          customerName: pendingSaleCustomerName(payload, partnerById),
          documentDate: payload.documentDate,
          notes: payload.notes,
          cashRegistered: payload.cashRegistered,
          paymentMethod: payload.paymentMethod,
          totalLei: payload.lines.reduce(
            (total, line) => total + line.quantity * line.unitPriceLei,
            0,
          ),
          lines: payload.lines.map((line) => {
            const product = line.productId ? productById.get(line.productId) : null;
            return {
              productId: line.productId,
              productLabel: product
                ? [
                    `${product.externalCode ? `${product.externalCode} · ` : ""}${product.description}`,
                    vehicleLabel(product.fitment),
                  ]
                    .filter(Boolean)
                    .join(" — ")
                : line.externalName
                  ? `${line.externalCode ? `${line.externalCode} · ` : ""}${line.externalName} (extern)`
                  : "Produs indisponibil",
              quantity: line.quantity,
              unitPriceLei: line.unitPriceLei,
            };
          }),
        },
      };
    }

    const account = accountById.get(operation.payload.paymentAccountId);
    return {
      ...row,
      details: {
        kind: "PAYMENT_ACCOUNT_FULFILLMENT" as const,
        paymentAccountId: operation.payload.paymentAccountId,
        accountNumber: account?.number ?? null,
        customerName: account?.customerName ?? "Cont indisponibil",
        warehouseName: account?.warehouse.name ?? "Locație indisponibilă",
        totalLei: Number(account?.totalGross ?? 0),
        lines:
          account?.lines.map((line) => ({
            productId: line.productId,
            productLabel: [
              `${line.productCode ? `${line.productCode} · ` : ""}${line.description}`,
              vehicleLabel(line.product?.fitment),
            ]
              .filter(Boolean)
              .join(" — "),
            quantity: line.quantity,
            unitPriceLei: Number(line.unitPriceGross),
          })) ?? [],
      },
    };
  });

  const byId = new Map(hydrated.map((row) => [row.id, row]));
  return {
    pending: pendingRows.map((row) => byId.get(row.id)!),
    rejected: rejectedRows.map((row) => byId.get(row.id)!),
    approved: approvedRows.map((row) => byId.get(row.id)!),
  };
}

export type ApprovalsData = Awaited<ReturnType<typeof getApprovalsData>>;
