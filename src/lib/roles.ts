import type { AppRole } from "@/generated/prisma/enums";
import type { WorkspaceSectionId } from "@/lib/operations/workspace";

export const WRITE_ROLES: readonly AppRole[] = ["ADMIN", "DIRECTOR"];
export const STAFF_ROLES: readonly AppRole[] = ["ADMIN"];
export const ALL_ROLES: readonly AppRole[] = ["ADMIN", "DIRECTOR", "ANGAJAT"];

/** Secțiunile pe care un ANGAJAT le poate deschide: produse în stoc + vânzări. */
export const EMPLOYEE_SECTIONS: readonly WorkspaceSectionId[] = ["produse", "vanzari"];

export function canWriteCatalog(role: AppRole | null | undefined) {
  return role ? WRITE_ROLES.includes(role) : false;
}

/** Orice rol autentificat poate înregistra vânzări (inclusiv ANGAJAT). */
export function canCreateSales(role: AppRole | null | undefined) {
  return role ? ALL_ROLES.includes(role) : false;
}

/** Vizibilitatea secțiunilor pe rol; folosită de nav + redirect-ul din pagină. */
export function canViewSection(
  role: AppRole | null | undefined,
  section: WorkspaceSectionId,
) {
  if (!role) return false;
  if (section === "personal") return canManageStaff(role);
  if (section === "istoric") return canWriteCatalog(role);
  if (role === "ANGAJAT") return EMPLOYEE_SECTIONS.includes(section);
  return true;
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

/** Guard against disabling the final active ADMIN account. */
export function wouldDeactivateLastAdmin(
  users: { id: string; role: AppRole; active: boolean }[],
  targetUserId: string,
) {
  const target = users.find((user) => user.id === targetUserId);
  if (target?.role !== "ADMIN" || !target.active) return false;

  return !users.some(
    (user) =>
      user.id !== targetUserId && user.role === "ADMIN" && user.active,
  );
}
