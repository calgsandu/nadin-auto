import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";
import type { CurrentAppUser } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";

/** Anything with an auditLog delegate — the client or an open transaction. */
type AuditClient = Pick<typeof prisma, "auditLog"> | Prisma.TransactionClient;

export type AuditEntry = {
  action: AuditAction;
  /** Ex: "StockDocument", "Product", "Partner". */
  entity: string;
  entityId?: string | null;
  /** Text scurt, lizibil: „Vânzare #12 ștearsă (3 produse, 450 lei)". */
  summary: string;
  /** Snapshot before/after sau orice context util pentru diff. */
  details?: Prisma.InputJsonValue;
};

/**
 * Scrie o intrare în jurnalul de audit. Nu aruncă niciodată — un eșec de
 * logare nu trebuie să strice operațiunea în sine (decât în tranzacții,
 * unde eșecul face oricum rollback la tot).
 */
export async function logAudit(
  client: AuditClient,
  user: CurrentAppUser | null,
  entry: AuditEntry,
) {
  try {
    await client.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        details: entry.details,
      },
    });
  } catch (error) {
    console.error("[audit] logare eșuată:", error);
  }
}

/** Snapshot serializabil al unui document de stoc pentru details. */
export function documentSnapshot(doc: {
  type: string;
  number: number;
  documentDate: Date;
  notes: string | null;
  totalLei: { toString(): string } | null;
  totalEuro: { toString(): string } | null;
  warehouse?: { name: string } | null;
  partner?: { name: string } | null;
  lines: {
    productId: string;
    quantity: number;
    unitPriceEuro: { toString(): string } | null;
    unitCostLei: { toString(): string } | null;
    product?: { description: string; externalCode: string | null } | null;
  }[];
}) {
  return {
    type: doc.type,
    number: doc.number,
    documentDate: doc.documentDate.toISOString().slice(0, 10),
    notes: doc.notes,
    totalLei: doc.totalLei != null ? Number(doc.totalLei) : null,
    totalEuro: doc.totalEuro != null ? Number(doc.totalEuro) : null,
    warehouse: doc.warehouse?.name ?? null,
    partner: doc.partner?.name ?? null,
    lines: doc.lines.map((line) => ({
      productId: line.productId,
      product: line.product
        ? `${line.product.externalCode ? `${line.product.externalCode} · ` : ""}${line.product.description}`
        : null,
      quantity: line.quantity,
      price: Number(line.unitPriceEuro ?? line.unitCostLei ?? 0),
    })),
  };
}
