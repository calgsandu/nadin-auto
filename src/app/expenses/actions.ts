"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { isDuplicateKeyError, readToken } from "@/lib/operations/idempotency";
import { parseExpenseForm } from "@/lib/finance/expense-form";
import { expenseCategoryLabel } from "@/lib/finance/categories";
import { assertPeriodOpen } from "@/lib/finance/period-lock";

export type ExpenseActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_ERROR: ExpenseActionState = {
  ok: false,
  message: "Cheltuiala nu a putut fi salvată.",
};

async function requireExpenseWrite() {
  const appUser = await requireCurrentAppUser();
  if (!canWriteCatalog(appUser.role)) {
    throw new Error("Nu ai drepturi pentru cheltuieli.");
  }
  return appUser;
}

/**
 * Numerotarea cheltuielilor, cu aceeași apărare ca documentele de stoc: fără
 * advisory lock două salvări simultane iau același număr, iar unique-ul de pe
 * `number` respinge una dintre ele cu o eroare de bază de date, nu cu un mesaj.
 */
async function nextExpenseNumber(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('expense:number'))`;
  const last = await tx.expense.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

export async function createExpenseAction(
  _state: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  try {
    const user = await requireExpenseWrite();

    const token = readToken(formData);
    if (token) {
      const already = await prisma.expense.findUnique({
        where: { idempotencyKey: token },
        select: { number: true },
      });
      if (already) {
        return { ok: true, message: `Cheltuiala #${already.number} era deja înregistrată.` };
      }
    }

    const parsed = parseExpenseForm(formData);
    if (!parsed.ok) throw new Error(parsed.message);
    await assertPeriodOpen(parsed.data.date);

    const expense = await prisma.$transaction(async (tx) =>
      tx.expense.create({
        data: {
          ...parsed.data,
          number: await nextExpenseNumber(tx),
          idempotencyKey: token,
          createdById: user.id,
          createdByName: user.name,
        },
        select: { id: true, number: true },
      }),
    );

    await logAudit(prisma, user, {
      action: "CREATE",
      entity: "Expense",
      entityId: expense.id,
      summary: `Cheltuială #${expense.number}: ${parsed.data.amountLei} lei — ${expenseCategoryLabel(parsed.data.category)}`,
      details: {
        ...parsed.data,
        date: parsed.data.date.toISOString(),
      },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: `Cheltuiala #${expense.number} a fost salvată.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateExpenseAction(
  _state: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  try {
    const user = await requireExpenseWrite();

    const id = readString(formData, "expenseId");
    if (!id) throw new Error("Lipsește cheltuiala pentru editare.");

    const parsed = parseExpenseForm(formData);
    if (!parsed.ok) throw new Error(parsed.message);

    const before = await prisma.expense.findUnique({
      where: { id },
      select: {
        number: true,
        date: true,
        category: true,
        amountLei: true,
        description: true,
        partnerId: true,
        accountId: true,
        notes: true,
      },
    });
    if (!before) throw new Error("Cheltuiala nu există.");
    // Şi luna în care stă, şi cea în care ar ajunge, trebuie să fie deschise.
    await assertPeriodOpen(before.date, parsed.data.date);

    await prisma.expense.update({ where: { id }, data: parsed.data });

    await logAudit(prisma, user, {
      action: "UPDATE",
      entity: "Expense",
      entityId: id,
      summary: `Cheltuiala #${before.number} modificată (${Number(before.amountLei)} → ${parsed.data.amountLei} lei)`,
      details: {
        before: { ...before, amountLei: Number(before.amountLei), date: before.date.toISOString() },
        after: { ...parsed.data, date: parsed.data.date.toISOString() },
      },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: `Cheltuiala #${before.number} a fost actualizată.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteExpenseAction(
  _state: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  try {
    const user = await requireExpenseWrite();

    const id = readString(formData, "expenseId");
    if (!id) throw new Error("Lipsește cheltuiala.");

    const expense = await prisma.expense.findUnique({
      where: { id },
      select: {
        number: true,
        date: true,
        category: true,
        amountLei: true,
        description: true,
        partnerId: true,
        accountId: true,
        notes: true,
      },
    });
    if (!expense) throw new Error("Cheltuiala nu există.");
    await assertPeriodOpen(expense.date);

    await prisma.expense.delete({ where: { id } });

    await logAudit(prisma, user, {
      action: "DELETE",
      entity: "Expense",
      entityId: id,
      summary: `Cheltuiala #${expense.number} ștearsă (${Number(expense.amountLei)} lei — ${expense.description})`,
      details: {
        ...expense,
        amountLei: Number(expense.amountLei),
        date: expense.date.toISOString(),
      },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: `Cheltuiala #${expense.number} a fost ștearsă.` };
  } catch (error) {
    return toActionError(error);
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toActionError(error: unknown): ExpenseActionState {
  if (isDuplicateKeyError(error)) {
    return { ok: true, message: "Cheltuiala era deja înregistrată." };
  }
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return INITIAL_ERROR;
}
