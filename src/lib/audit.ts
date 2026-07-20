import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";
/** Anything with an auditLog delegate — the client or an open transaction. */
type AuditClient = {
  auditLog: {
    create(args: Prisma.AuditLogCreateArgs): Promise<unknown>;
  };
};

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

export type AuditActor = {
  id: string;
  role: "ADMIN" | "DIRECTOR" | "ANGAJAT";
  name: string | null;
  email: string | null;
};

/**
 * Scriere obligatorie pentru operațiuni tranzacționale. Orice eroare este
 * propagată ca tranzacția de stoc să poată face rollback.
 */
export async function logAuditRequired(
  client: AuditClient,
  user: AuditActor | null,
  entry: AuditEntry,
) {
  await client.auditLog.create({
    data: auditData(user, entry),
  });
}

/** Scriere best-effort pentru evenimente care nu controlează stocul. */
export async function logAuditBestEffort(
  client: AuditClient,
  user: AuditActor | null,
  entry: AuditEntry,
) {
  try {
    await logAuditRequired(client, user, entry);
  } catch (error) {
    console.error("[audit] logare eșuată:", error);
  }
}

/** Compatibilitate pentru apelurile non-tranzacționale existente. */
export const logAudit = logAuditBestEffort;

function auditData(user: AuditActor | null, entry: AuditEntry) {
  return {
    userId: user?.id ?? null,
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    details: entry.details,
    reviewStatus: "APPROVED" as const,
  };
}

/** Snapshot serializabil al unui document de stoc pentru details. */
export function documentSnapshot(doc: {
  type: string;
  number: number;
  documentDate: Date;
  sourceDocumentId?: string | null;
  transferGroupId?: string | null;
  notes: string | null;
  totalLei: { toString(): string } | null;
  totalEuro: { toString(): string } | null;
  warehouse?: { name: string } | null;
  partner?: { name: string } | null;
  lines: {
    productId: string | null;
    externalName?: string | null;
    externalCode?: string | null;
    externalSupplierId?: string | null;
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
    sourceDocumentId: doc.sourceDocumentId ?? null,
    transferGroupId: doc.transferGroupId ?? null,
    notes: doc.notes,
    totalLei: doc.totalLei != null ? Number(doc.totalLei) : null,
    totalEuro: doc.totalEuro != null ? Number(doc.totalEuro) : null,
    warehouse: doc.warehouse?.name ?? null,
    partner: doc.partner?.name ?? null,
    lines: doc.lines.map((line) => ({
      productId: line.productId,
      externalName: line.externalName ?? null,
      externalCode: line.externalCode ?? null,
      externalSupplierId: line.externalSupplierId ?? null,
      product: line.product
        ? `${line.product.externalCode ? `${line.product.externalCode} · ` : ""}${line.product.description}`
        : line.externalName
          ? `${line.externalCode ? `${line.externalCode} · ` : ""}${line.externalName}`
          : null,
      quantity: line.quantity,
      price: Number(line.unitPriceEuro ?? line.unitCostLei ?? 0),
    })),
  };
}
