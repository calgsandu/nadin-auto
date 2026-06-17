"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canManageStaff, wouldDeleteLastAdmin, wouldRemoveLastAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/generated/prisma/enums";

export type StaffActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_ERROR: StaffActionState = {
  ok: false,
  message: "Rolul nu a putut fi salvat.",
};

const DELETE_ERROR: StaffActionState = {
  ok: false,
  message: "Utilizatorul nu a putut fi șters.",
};

const VALID_ROLES: readonly AppRole[] = ["ADMIN", "DIRECTOR", "ANGAJAT"];

export async function setUserRoleAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    const appUser = await requireCurrentAppUser();
    if (!canManageStaff(appUser.role)) {
      throw new Error("Doar un administrator poate schimba rolurile.");
    }

    const userId = readString(formData, "userId");
    const role = readString(formData, "role") as AppRole;
    if (!userId) throw new Error("Lipsește utilizatorul.");
    if (!VALID_ROLES.includes(role)) throw new Error("Rol invalid.");

    const users = await prisma.appUser.findMany({ select: { id: true, role: true } });
    if (wouldRemoveLastAdmin(users, userId, role)) {
      throw new Error("Trebuie să rămână cel puțin un administrator.");
    }

    await prisma.appUser.update({ where: { id: userId }, data: { role } });
    revalidatePath("/");
    return { ok: true, message: "Rolul a fost actualizat." };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteUserAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    const appUser = await requireCurrentAppUser();
    if (!canManageStaff(appUser.role)) {
      throw new Error("Doar un administrator poate șterge utilizatori.");
    }

    const userId = readString(formData, "userId");
    if (!userId) throw new Error("Lipsește utilizatorul.");
    if (userId === appUser.id) {
      throw new Error("Nu poți șterge propriul cont.");
    }

    const users = await prisma.appUser.findMany({ select: { id: true, role: true } });
    if (!users.some((user) => user.id === userId)) {
      throw new Error("Utilizatorul nu există.");
    }
    if (wouldDeleteLastAdmin(users, userId)) {
      throw new Error("Trebuie să rămână cel puțin un administrator.");
    }

    await prisma.appUser.delete({ where: { id: userId } });
    revalidatePath("/");
    return { ok: true, message: "Utilizatorul a fost șters." };
  } catch (error) {
    return toActionError(error, DELETE_ERROR);
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toActionError(
  error: unknown,
  fallback: StaffActionState = INITIAL_ERROR,
): StaffActionState {
  if (error instanceof Error) {
    return { ok: false, message: error.message };
  }
  return fallback;
}
