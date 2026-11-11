"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { isDuplicateKeyError, readToken } from "@/lib/operations/idempotency";
import { isMovementKind, movementKindLabel, movementSign } from "@/lib/finance/movements";
import { assertPeriodOpen } from "@/lib/finance/period-lock";

export type MoneyActionState = { ok: boolean; message: string };

const FALLBACK: MoneyActionState = { ok: false, message: "Operațiunea a eșuat." };

async function requireMoneyWrite() {
  const appUser = await requireCurrentAppUser();
  if (!canWriteCatalog(appUser.role)) {
    throw new Error("Nu ai drepturi pentru operațiunile de casă.");
  }
  return appUser;
}

export async function createMovementAction(
  _state: MoneyActionState,
  formData: FormData,
): Promise<MoneyActionState> {
  try {
    const user = await requireMoneyWrite();

    const token = readToken(formData);
    if (token) {
      const already = await prisma.moneyMovement.findUnique({
        where: { idempotencyKey: token },
        select: { id: true },
      });
      if (already) return { ok: true, message: "Mișcarea era deja înregistrată." };
    }

    const kindRaw = readString(formData, "kind");
    if (!isMovementKind(kindRaw)) throw new Error("Alege tipul mișcării.");

    const accountId = readString(formData, "accountId");
    if (!accountId) throw new Error("Alege contul.");

    const amount = Number(readString(formData, "amountLei").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Suma trebuie să fie mai mare decât zero.");
    }

    const dateRaw = readString(formData, "date");
    const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error("Data nu este validă.");
    await assertPeriodOpen(date);

    const notes = readString(formData, "notes") || null;
    const accounts = await prisma.moneyAccount.findMany({
      where: { active: true },
      select: { id: true, name: true },
    });
    const account = accounts.find((one) => one.id === accountId);
    if (!account) throw new Error("Contul nu există.");

    if (kindRaw === "TRANSFER") {
      const counterAccountId = readString(formData, "counterAccountId");
      const counter = accounts.find((one) => one.id === counterAccountId);
      if (!counter) throw new Error("Alege contul în care intră banii.");
      if (counter.id === account.id) {
        throw new Error("Transferul are nevoie de două conturi diferite.");
      }

      // Două rânduri legate: fiecare cont își vede propria mișcare, iar
      // ștergerea perechii se face după grup, nu rând cu rând.
      const transferGroupId = randomUUID();
      await prisma.moneyMovement.createMany({
        data: [
          {
            accountId: account.id,
            counterAccountId: counter.id,
            transferGroupId,
            date,
            amountLei: -amount,
            kind: "TRANSFER",
            notes: notes ?? `Transfer către ${counter.name}`,
            idempotencyKey: token,
            createdById: user.id,
            createdByName: user.name,
          },
          {
            accountId: counter.id,
            counterAccountId: account.id,
            transferGroupId,
            date,
            amountLei: amount,
            kind: "TRANSFER",
            notes: notes ?? `Transfer din ${account.name}`,
            createdById: user.id,
            createdByName: user.name,
          },
        ],
      });

      await logAudit(prisma, user, {
        action: "CREATE",
        entity: "MoneyMovement",
        entityId: transferGroupId,
        summary: `Transfer ${amount} lei din ${account.name} în ${counter.name}`,
        details: { transferGroupId, amount, date: date.toISOString(), notes },
      });

      revalidatePath("/crm", "layout");
      return { ok: true, message: `Transfer de ${amount} lei înregistrat.` };
    }

    const amountLei = amount * movementSign(kindRaw);
    const movement = await prisma.moneyMovement.create({
      data: {
        accountId: account.id,
        date,
        amountLei,
        kind: kindRaw,
        notes,
        idempotencyKey: token,
        createdById: user.id,
        createdByName: user.name,
      },
      select: { id: true },
    });

    await logAudit(prisma, user, {
      action: "CREATE",
      entity: "MoneyMovement",
      entityId: movement.id,
      summary: `${movementKindLabel(kindRaw)} ${amount} lei — ${account.name}`,
      details: { accountId: account.id, amountLei, kind: kindRaw, date: date.toISOString(), notes },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: `${movementKindLabel(kindRaw)} de ${amount} lei înregistrată.` };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMovementAction(
  _state: MoneyActionState,
  formData: FormData,
): Promise<MoneyActionState> {
  try {
    const user = await requireMoneyWrite();

    const id = readString(formData, "movementId");
    if (!id) throw new Error("Lipsește mișcarea.");

    const movement = await prisma.moneyMovement.findUnique({
      where: { id },
      select: { id: true, kind: true, amountLei: true, date: true, notes: true, transferGroupId: true },
    });
    if (!movement) throw new Error("Mișcarea nu există.");
    await assertPeriodOpen(movement.date);

    // Transferul se șterge ca pereche: o jumătate ștearsă ar face banii să
    // dispară dintr-un cont fără să apară în celălalt.
    const deleted = movement.transferGroupId
      ? await prisma.moneyMovement.deleteMany({
          where: { transferGroupId: movement.transferGroupId },
        })
      : await prisma.moneyMovement.deleteMany({ where: { id } });

    await logAudit(prisma, user, {
      action: "DELETE",
      entity: "MoneyMovement",
      entityId: id,
      summary: `${movementKindLabel(movement.kind)} de ${Math.abs(Number(movement.amountLei))} lei ștearsă`,
      details: {
        kind: movement.kind,
        amountLei: Number(movement.amountLei),
        date: movement.date.toISOString(),
        notes: movement.notes,
        transferGroupId: movement.transferGroupId,
        rowsDeleted: deleted.count,
      },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: "Mișcarea a fost ștearsă." };
  } catch (error) {
    return fail(error);
  }
}

/** Contul de bani: numele, soldul de pornire și ziua de la care se numără. */
export async function saveAccountAction(
  _state: MoneyActionState,
  formData: FormData,
): Promise<MoneyActionState> {
  try {
    const user = await requireMoneyWrite();

    const id = readString(formData, "accountId");
    const name = readString(formData, "name");
    if (!name) throw new Error("Contul are nevoie de un nume.");

    const kind = readString(formData, "kind") === "BANK" ? "BANK" : "CASH";
    const openingBalanceLei = Number(readString(formData, "openingBalanceLei").replace(",", ".") || "0");
    if (!Number.isFinite(openingBalanceLei)) {
      throw new Error("Soldul de pornire nu este un număr.");
    }

    const openingRaw = readString(formData, "openingDate");
    const openingDate = openingRaw ? new Date(`${openingRaw}T00:00:00`) : new Date();
    if (Number.isNaN(openingDate.getTime())) throw new Error("Data soldului nu este validă.");

    const iban = readString(formData, "iban") || null;
    const data = { name, kind, openingBalanceLei, openingDate, iban } as const;

    if (id) {
      await prisma.moneyAccount.update({ where: { id }, data });
    } else {
      await prisma.moneyAccount.create({ data });
    }

    await logAudit(prisma, user, {
      action: id ? "UPDATE" : "CREATE",
      entity: "MoneyAccount",
      entityId: id || null,
      summary: `Cont „${name}", sold de pornire ${openingBalanceLei} lei`,
      details: { ...data, openingDate: openingDate.toISOString() },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: `Contul „${name}" a fost salvat.` };
  } catch (error) {
    return fail(error);
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(error: unknown): MoneyActionState {
  if (isDuplicateKeyError(error)) {
    return { ok: true, message: "Mișcarea era deja înregistrată." };
  }
  if (isDuplicateKeyError(error, "name")) {
    return { ok: false, message: "Există deja un cont cu acest nume." };
  }
  if (error instanceof Error) return { ok: false, message: error.message };
  return FALLBACK;
}
