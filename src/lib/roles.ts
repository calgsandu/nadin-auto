import type { AppRole } from "@/generated/prisma/enums";

export const WRITE_ROLES: readonly AppRole[] = ["ADMIN", "DIRECTOR"];
export const STAFF_ROLES: readonly AppRole[] = ["ADMIN"];
export const ALL_ROLES: readonly AppRole[] = ["ADMIN", "DIRECTOR", "ANGAJAT"];

export function canWriteCatalog(role: AppRole | null | undefined) {
  return role ? WRITE_ROLES.includes(role) : false;
}

/** Only ADMIN may view/administer the Personal section and change roles. */
export function canManageStaff(role: AppRole | null | undefined) {
  return role ? STAFF_ROLES.includes(role) : false;
}

/**
 * Guard against locking everyone out: returns true when changing `targetUserId`
 * to `newRole` would leave zero ADMIN users.
 */
export function wouldRemoveLastAdmin(
  users: { id: string; role: AppRole }[],
  targetUserId: string,
  newRole: AppRole,
) {
  if (newRole === "ADMIN") return false;
  const remainingAdmins = users.filter(
    (u) => u.role === "ADMIN" && u.id !== targetUserId,
  ).length;
  return remainingAdmins === 0;
}

/** Guard against deleting the final ADMIN account. */
export function wouldDeleteLastAdmin(
  users: { id: string; role: AppRole }[],
  targetUserId: string,
) {
  const target = users.find((u) => u.id === targetUserId);
  if (target?.role !== "ADMIN") return false;
  const remainingAdmins = users.filter(
    (u) => u.role === "ADMIN" && u.id !== targetUserId,
  ).length;
  return remainingAdmins === 0;
}
