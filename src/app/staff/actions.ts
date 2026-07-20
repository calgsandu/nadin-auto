"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import {
  canManageStaff,
  wouldDeactivateLastAdmin,
  wouldRemoveLastAdmin,
} from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { technicalEmailForUsername } from "@/lib/auth/username";
import {
  banAuthIdentity,
  createAuthIdentity,
  getAuthProviderIds,
  removeAuthIdentity,
  revokeAuthSessions,
  setAuthRole,
  setAuthPassword,
  unbanAuthIdentity,
} from "@/lib/staff/auth-admin";
import {
  parseCreateStaffInput,
  needsPasswordMigration,
  parsePassword,
  parseUserId,
  toAuthRole,
} from "@/lib/staff/validate";
import type { AppRole } from "@/generated/prisma/enums";

export type StaffActionState = {
  ok: boolean;
  message: string;
  revealedPassword?: string;
};

const VALID_ROLES: readonly AppRole[] = ["ADMIN", "DIRECTOR", "ANGAJAT"];
const INITIAL_ERROR: StaffActionState = {
  ok: false,
  message: "Operațiunea nu a putut fi finalizată.",
};

async function requireStaffAdmin() {
  const user = await requireCurrentAppUser();
  if (!canManageStaff(user.role)) {
    throw new Error("Doar un administrator poate administra personalul.");
  }
  return user;
}

export async function createStaffUserAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  let createdAuthUserId: string | null = null;
  try {
    const admin = await requireStaffAdmin();
    const input = parseCreateStaffInput(formData);
    const duplicate = await prisma.appUser.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (duplicate) throw new Error("Acest nume de utilizator este deja folosit.");

    const email = technicalEmailForUsername(input.username);
    createdAuthUserId = await createAuthIdentity({
      email,
      password: input.password,
      name: input.name,
      authRole: toAuthRole(input.role),
    });

    const created = await prisma.appUser.create({
      data: {
        authUserId: createdAuthUserId,
        username: input.username,
        email,
        name: input.name,
        role: input.role,
        active: true,
      },
    });
    await logAudit(prisma, admin, {
      action: "CREATE",
      entity: "AppUser",
      entityId: created.id,
      summary: `Utilizator creat: ${input.username} (${input.role})`,
      details: { username: input.username, role: input.role },
    });
    revalidatePath("/crm");
    return {
      ok: true,
      message: "Utilizatorul a fost creat.",
      revealedPassword: input.password,
    };
  } catch (error) {
    if (createdAuthUserId) {
      try {
        await removeAuthIdentity(createdAuthUserId);
      } catch {
        return {
          ok: false,
          message:
            "Profilul nu a putut fi creat, iar identitatea incompletă necesită verificare în Neon Auth.",
        };
      }
    }
    return toActionError(error);
  }
}

export async function resetStaffPasswordAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    const admin = await requireStaffAdmin();
    const userId = parseUserId(formData);
    const passwordValue = formData.get("password");
    const password = parsePassword(
      typeof passwordValue === "string" ? passwordValue : "",
    );
    const target = await prisma.appUser.findUnique({ where: { id: userId } });
    if (!target) throw new Error("Utilizatorul nu există.");

    const providers = await getAuthProviderIds(target.authUserId);
    const migrateToPassword = needsPasswordMigration(providers);
    if (migrateToPassword) {
      if (!target.username) {
        throw new Error("Contul trebuie să aibă un username înainte de migrare.");
      }
      const oldAuthUserId = target.authUserId;
      const email = technicalEmailForUsername(target.username);
      const newAuthUserId = await createAuthIdentity({
        email,
        password,
        name: target.name ?? target.username,
        authRole: toAuthRole(target.role),
      });
      try {
        await prisma.appUser.update({
          where: { id: target.id },
          data: { authUserId: newAuthUserId, email },
        });
      } catch (error) {
        await removeAuthIdentity(newAuthUserId).catch(() => undefined);
        throw error;
      }
      await revokeAuthSessions(oldAuthUserId).catch(() => undefined);
    } else {
      await setAuthPassword(target.authUserId, password);
      await revokeAuthSessions(target.authUserId);
    }
    await logAudit(prisma, admin, {
      action: "UPDATE",
      entity: "AppUser",
      entityId: target.id,
      summary: `${migrateToPassword ? "Cont migrat la username/parolă" : "Parolă resetată"} pentru ${target.username ?? target.name ?? target.id}`,
      details: { username: target.username, migratedFromSocial: migrateToPassword },
    });
    return {
      ok: true,
      message: migrateToPassword
        ? "Contul a fost migrat la autentificare cu username și parolă. Autentifică-te din nou."
        : "Parola a fost resetată.",
      revealedPassword: password,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setStaffActiveAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    const admin = await requireStaffAdmin();
    const userId = parseUserId(formData);
    const active = formData.get("active") === "true";
    const users = await prisma.appUser.findMany();
    const target = users.find((user) => user.id === userId);
    if (!target) throw new Error("Utilizatorul nu există.");
    if (!active && target.id === admin.id) {
      throw new Error("Nu îți poți dezactiva propriul cont.");
    }
    if (!active && wouldDeactivateLastAdmin(users, target.id)) {
      throw new Error("Trebuie să rămână cel puțin un administrator activ.");
    }

    if (!active) {
      await prisma.appUser.update({ where: { id: target.id }, data: { active: false } });
      try {
        await banAuthIdentity(target.authUserId);
        await revokeAuthSessions(target.authUserId);
      } catch {
        revalidatePath("/crm");
        return {
          ok: false,
          message:
            "Accesul local a fost blocat, dar sincronizarea cu Neon Auth trebuie reîncercată.",
        };
      }
    } else {
      await unbanAuthIdentity(target.authUserId);
      await prisma.appUser.update({ where: { id: target.id }, data: { active: true } });
    }

    await logAudit(prisma, admin, {
      action: "UPDATE",
      entity: "AppUser",
      entityId: target.id,
      summary: `${active ? "Cont reactivat" : "Cont dezactivat"}: ${target.username ?? target.name ?? target.id}`,
      details: { username: target.username, active },
    });
    revalidatePath("/crm");
    return {
      ok: true,
      message: active ? "Contul a fost reactivat." : "Contul a fost dezactivat.",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setUserRoleAction(
  _state: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    await requireStaffAdmin();
    const userId = parseUserId(formData);
    const role = String(formData.get("role") ?? "") as AppRole;
    if (!VALID_ROLES.includes(role)) throw new Error("Rol invalid.");

    const users = await prisma.appUser.findMany({
      select: { id: true, authUserId: true, role: true, active: true },
    });
    if (
      wouldRemoveLastAdmin(users, userId, role) ||
      (role !== "ADMIN" && wouldDeactivateLastAdmin(users, userId))
    ) {
      throw new Error("Trebuie să rămână cel puțin un administrator activ.");
    }

    const target = users.find((user) => user.id === userId);
    if (!target) throw new Error("Utilizatorul nu există.");
    const previousAuthRole = toAuthRole(target.role);
    const nextAuthRole = toAuthRole(role);
    if (previousAuthRole !== nextAuthRole) {
      await setAuthRole(target.authUserId, nextAuthRole);
    }
    try {
      await prisma.appUser.update({ where: { id: userId }, data: { role } });
    } catch (error) {
      if (previousAuthRole !== nextAuthRole) {
        await setAuthRole(target.authUserId, previousAuthRole).catch(() => undefined);
      }
      throw error;
    }
    revalidatePath("/crm");
    return { ok: true, message: "Rolul a fost actualizat." };
  } catch (error) {
    return toActionError(error);
  }
}

function toActionError(error: unknown): StaffActionState {
  if (error instanceof Error && error.message) {
    return { ok: false, message: error.message };
  }
  return INITIAL_ERROR;
}
