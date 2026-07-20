import { prisma } from "@/lib/prisma";

const ROLE_ORDER = { ADMIN: 0, DIRECTOR: 1, ANGAJAT: 2 } as const;

/** All application users with their roles, ADMIN first then by name/email. */
export async function getStaffData() {
  const records = await prisma.appUser.findMany({
    include: {
      twoFactorCredential: {
        select: { status: true },
      },
      twoFactorEnrollmentGrant: {
        select: { expiresAt: true },
      },
    },
  });
  const now = new Date();
  const users = records.map(
    ({ twoFactorCredential, twoFactorEnrollmentGrant, ...user }) => ({
      ...user,
      twoFactorStatus:
        twoFactorCredential?.status === "ACTIVE"
          ? ("ACTIVE" as const)
          : twoFactorCredential?.status === "PENDING"
            ? ("PENDING" as const)
            : twoFactorEnrollmentGrant?.expiresAt
                && twoFactorEnrollmentGrant.expiresAt > now
              ? ("CODE_ISSUED" as const)
              : ("NOT_CONFIGURED" as const),
      twoFactorActivationExpiresAt: twoFactorEnrollmentGrant?.expiresAt ?? null,
    }),
  );

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
