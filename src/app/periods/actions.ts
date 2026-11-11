"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canManageStaff, canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { monthLabel } from "@/lib/finance/months";

export type PeriodActionState = { ok: boolean; message: string };

const FALLBACK: PeriodActionState = { ok: false, message: "Operațiunea a eșuat." };

/** Închide o lună: documentele datate în ea devin needitabile. */
export async function closeMonthAction(
  _state: PeriodActionState,
  formData: FormData,
): Promise<PeriodActionState> {
  try {
    const user = await requireCurrentAppUser();
    if (!canWriteCatalog(user.role)) {
      throw new Error("Nu ai drepturi pentru închiderea lunii.");
    }

    const month = readMonth(formData);
    const note = readString(formData, "note") || null;

    const existing = await prisma.accountingPeriod.findUnique({ where: { month } });
    if (existing && existing.reopenedAt === null) {
      return { ok: true, message: `Luna ${monthLabel(month)} era deja închisă.` };
    }

    // O lună redeschisă se închide la loc pe același rând: istoricul rămâne în
    // jurnalul de audit, nu într-un al doilea rând care ar strica unicitatea.
    await prisma.accountingPeriod.upsert({
      where: { month },
      create: {
        month,
        note,
        closedById: user.id,
        closedByName: user.name,
      },
      update: {
        note,
        closedAt: new Date(),
        closedById: user.id,
        closedByName: user.name,
        reopenedAt: null,
        reopenedById: null,
        reopenedByName: null,
        reopenNote: null,
      },
    });

    await logAudit(prisma, user, {
      action: existing ? "UPDATE" : "CREATE",
      entity: "AccountingPeriod",
      entityId: month,
      summary: `Luna ${monthLabel(month)} a fost închisă`,
      details: { month, note },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: `Luna ${monthLabel(month)} a fost închisă.` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Redeschide o lună închisă. Doar ADMIN, cu motiv obligatoriu: o lună închisă
 * înseamnă de obicei o declarație deja depusă, iar schimbările de după ea
 * trebuie să lase urmă.
 */
export async function reopenMonthAction(
  _state: PeriodActionState,
  formData: FormData,
): Promise<PeriodActionState> {
  try {
    const user = await requireCurrentAppUser();
    if (!canManageStaff(user.role)) {
      throw new Error("Doar un administrator poate redeschide o lună închisă.");
    }

    const month = readMonth(formData);
    const reason = readString(formData, "reason");
    if (!reason) throw new Error("Scrie de ce redeschizi luna.");

    const period = await prisma.accountingPeriod.findUnique({ where: { month } });
    if (!period) throw new Error("Luna nu este închisă.");
    if (period.reopenedAt !== null) {
      return { ok: true, message: `Luna ${monthLabel(month)} era deja redeschisă.` };
    }

    await prisma.accountingPeriod.update({
      where: { month },
      data: {
        reopenedAt: new Date(),
        reopenedById: user.id,
        reopenedByName: user.name,
        reopenNote: reason,
      },
    });

    await logAudit(prisma, user, {
      action: "UPDATE",
      entity: "AccountingPeriod",
      entityId: month,
      summary: `Luna ${monthLabel(month)} a fost REDESCHISĂ: ${reason}`,
      details: { month, reason, closedAt: period.closedAt.toISOString() },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: `Luna ${monthLabel(month)} a fost redeschisă.` };
  } catch (error) {
    return fail(error);
  }
}

function readMonth(formData: FormData) {
  const month = readString(formData, "month");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Luna nu este validă.");
  return month;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(error: unknown): PeriodActionState {
  if (error instanceof Error) return { ok: false, message: error.message };
  return FALLBACK;
}
