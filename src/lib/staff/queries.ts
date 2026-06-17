import { prisma } from "@/lib/prisma";

const ROLE_ORDER = { ADMIN: 0, DIRECTOR: 1, ANGAJAT: 2 } as const;

/** All application users with their roles, ADMIN first then by name/email. */
export async function getStaffData() {
  const users = await prisma.appUser.findMany();

  users.sort((a, b) => {
    const byRole = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (byRole !== 0) return byRole;
    return (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "");
  });

  return { users };
}

export type StaffData = Awaited<ReturnType<typeof getStaffData>>;
export type StaffRow = StaffData["users"][number];
