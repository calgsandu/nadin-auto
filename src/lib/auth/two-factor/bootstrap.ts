import { prisma } from "@/lib/prisma";
import type { PrimaryAuthContext } from "./types";

export const APPLICATION_SECURITY_STATE_ID = "global";

export type BootstrapEligibilityInput = {
  currentUser: {
    id: string;
    role: "ADMIN" | "DIRECTOR" | "ANGAJAT";
    active: boolean;
    username: string | null;
  } | null;
  firstActiveAdminId: string | null;
  activeCredentialCount: number;
  bootstrapCompletedAt: Date | null;
  hasForeignLivePendingCredential: boolean;
};

export function isInitialTwoFactorBootstrapEligible(
  input: BootstrapEligibilityInput,
) {
  return Boolean(
    input.currentUser?.active
      && input.currentUser.role === "ADMIN"
      && input.currentUser.username
      && input.currentUser.id === input.firstActiveAdminId
      && input.activeCredentialCount === 0
      && !input.bootstrapCompletedAt
      && !input.hasForeignLivePendingCredential,
  );
}

export async function getInitialTwoFactorBootstrapEligibility(
  primary: PrimaryAuthContext,
  hasForeignLivePendingCredential: boolean,
) {
  const [currentUser, firstActiveAdmin, activeCredentialCount, securityState] =
    await Promise.all([
      prisma.appUser.findUnique({
        where: { id: primary.appUser.id },
        select: { id: true, role: true, active: true, username: true },
      }),
      prisma.appUser.findFirst({
        where: { role: "ADMIN", active: true, username: { not: null } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true },
      }),
      prisma.twoFactorCredential.count({ where: { status: "ACTIVE" } }),
      prisma.applicationSecurityState.findUnique({
        where: { id: APPLICATION_SECURITY_STATE_ID },
        select: { twoFactorBootstrapCompletedAt: true },
      }),
    ]);

  return isInitialTwoFactorBootstrapEligible({
    currentUser,
    firstActiveAdminId: firstActiveAdmin?.id ?? null,
    activeCredentialCount,
    bootstrapCompletedAt:
      securityState?.twoFactorBootstrapCompletedAt ?? null,
    hasForeignLivePendingCredential,
  });
}
