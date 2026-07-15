"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parsePartnerForm } from "@/lib/partners/validate";

export type PartnerActionState = {
  ok: boolean;
  message: string;
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

    await prisma.partner.create({ data: parsed.data });
    revalidatePath("/");
    return { ok: true, message: "Partenerul a fost adăugat." };
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
    revalidatePath("/");
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
    revalidatePath("/");
    return { ok: true, message: "Partenerul a fost șters." };
  } catch (error) {
    return toActionError(error);
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toActionError(error: unknown): PartnerActionState {
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return INITIAL_ERROR;
}
