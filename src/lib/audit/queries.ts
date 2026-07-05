import { prisma } from "@/lib/prisma";

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
