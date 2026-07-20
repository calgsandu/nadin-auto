import { prisma } from "@/lib/prisma";

const ROLE_ORDER = { ADMIN: 0, DIRECTOR: 1, ANGAJAT: 2 } as const;

/** All application users with their roles, ADMIN first then by name/email. */
export async function getStaffData() {
  const records = await prisma.appUser.findMany({
    include: {
      twoFactorCredential: {
        select: { status: true },
      },
    },
  });
  const users = records.map(({ twoFactorCredential, ...user }) => ({
    ...user,
    twoFactorStatus: twoFactorCredential?.status ?? ("NOT_CONFIGURED" as const),
  }));

  users.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const byRole = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (byRole !== 0) return byRole;
    return (a.name ?? a.username ?? "").localeCompare(b.name ?? b.username ?? "");
  });

  return { users };
}

export type StaffData = Awaited<ReturnType<typeof getStaffData>>;
export type StaffRow = StaffData["users"][number];
