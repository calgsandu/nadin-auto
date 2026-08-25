"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parsePartnerForm } from "@/lib/partners/validate";
import { logAudit } from "@/lib/audit";
import { isDuplicateKeyError, readToken } from "@/lib/operations/idempotency";

export type PartnerActionState = {
  ok: boolean;
  message: string;
  /**
   * Partenerul tocmai creat. Dat doar la creare, ca selectul din care s-a
   * plecat (recepție, comandă externă, editare document) să-l poată alege
   * fără să aștepte `revalidatePath`.
   */
  created?: { id: string; name: string };
};

const INITIAL_ERROR: PartnerActionState = {
  ok: false,
  message: "Partenerul nu a putut fi salvat.",
};

async function requirePartnerWrite() {
  const appUser = await requireCurrentAppUser();
  if (!canWriteCatalog(appUser.role)) {
    throw new Error("Nu ai drepturi pentru administrarea partenerilor.");
  }
}

export async function createPartnerAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  try {
    await requirePartnerWrite();
    const parsed = parsePartnerForm(formData);
    if (!parsed.ok) throw new Error(parsed.message);

    const existing = await prisma.partner.findUnique({
      where: { name: parsed.data.name },
    });
    if (existing) throw new Error("Există deja un partener cu acest nume.");

    const created = await prisma.partner.create({ data: parsed.data });
    revalidatePath("/crm", "layout");
    return {
      ok: true,
      message: "Partenerul a fost adăugat.",
      created: { id: created.id, name: created.name },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePartnerAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  try {
    await requirePartnerWrite();
    const id = readString(formData, "partnerId");
    if (!id) throw new Error("Lipsește partenerul pentru editare.");

    const parsed = parsePartnerForm(formData);
    if (!parsed.ok) throw new Error(parsed.message);

    const clash = await prisma.partner.findFirst({
      where: { name: parsed.data.name, NOT: { id } },
    });
    if (clash) throw new Error("Există deja un partener cu acest nume.");

    await prisma.partner.update({ where: { id }, data: parsed.data });
    revalidatePath("/crm", "layout");
    return { ok: true, message: "Partenerul a fost actualizat." };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deletePartnerAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  try {
    await requirePartnerWrite();
    const id = readString(formData, "partnerId");
    if (!id) throw new Error("Lipsește partenerul.");

    const [documents, paymentAccounts] = await Promise.all([
      prisma.stockDocument.count({ where: { partnerId: id } }),
      prisma.paymentAccount.count({ where: { partnerId: id } }),
    ]);
    if (documents + paymentAccounts > 0) {
      throw new Error(
        `Partenerul are ${documents + paymentAccounts} documente legate și nu poate fi șters.`,
      );
    }

    await prisma.partner.delete({ where: { id } });
    revalidatePath("/crm", "layout");
    return { ok: true, message: "Partenerul a fost șters." };
  } catch (error) {
    return toActionError(error);
  }
}

/** Încasare de la client — scade din datoria lui. */
export async function registerPartnerPaymentAction(
  _state: PartnerActionState,
  formData: FormData,
): Promise<PartnerActionState> {
  try {
    const user = await requireCurrentAppUser();
    if (!canWriteCatalog(user.role)) {
      throw new Error("Nu ai drepturi pentru încasări.");
    }

    const token = readToken(formData);
    if (token) {
      const already = await prisma.partnerPayment.findUnique({
        where: { idempotencyKey: token },
        select: { amount: true },
      });
      if (already) {
        return { ok: true, message: `Încasarea de ${Number(already.amount)} lei era deja înregistrată.` };
      }
    }

    const partnerId = readString(formData, "partnerId");
    const raw = readString(formData, "amount").replace(",", ".");
    const amount = Number(raw);
    const notes = readString(formData, "notes") || null;
    const paidAtRaw = readString(formData, "paidAt");

    if (!partnerId) throw new Error("Partener lipsă.");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Suma încasată trebuie să fie mai mare decât zero.");
    }
    const paidAt = paidAtRaw ? new Date(`${paidAtRaw}T12:00:00`) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new Error("Data încasării nu este validă.");

    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true },
    });
    if (!partner) throw new Error("Partenerul nu există.");

    const payment = await prisma.partnerPayment.create({
      data: { partnerId, amount, paidAt, notes, idempotencyKey: token },
    });
    await logAudit(prisma, user, {
      action: "CREATE",
      entity: "PartnerPayment",
      entityId: payment.id,
      summary: `Încasare ${amount} lei de la ${partner.name}`,
      details: { partnerId, amount, paidAt: paidAt.toISOString(), notes },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: `Încasare de ${amount} lei înregistrată.` };
  } catch (error) {
    return toActionError(error);
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toActionError(error: unknown): PartnerActionState {
  // Aceeași încasare trimisă de două ori în paralel: baza a respins-o pe a doua.
  if (isDuplicateKeyError(error)) {
    return { ok: true, message: "Încasarea era deja înregistrată." };
  }
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return INITIAL_ERROR;
}
