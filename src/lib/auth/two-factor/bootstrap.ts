import { Prisma } from "@/generated/prisma/client";
import { logAuditRequired } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readTwoFactorConfig } from "./config";
import { encryptTotpSecret, hashNeonSessionId } from "./crypto";
import { createTotpEnrollment } from "./totp";
import type { PrimaryAuthContext } from "./types";
import type { TotpEnrollmentView } from "./enrollment";

export const APPLICATION_SECURITY_STATE_ID = "global";
const SETUP_LIFETIME_MS = 15 * 60_000;

export class InitialTwoFactorBootstrapUnavailableError extends Error {
  constructor() {
    super(
      "Inițializarea 2FA nu mai este disponibilă. Cere unui administrator un cod de activare.",
    );
    this.name = "InitialTwoFactorBootstrapUnavailableError";
  }
}

export function bootstrapSetupExpiry(now: Date) {
  return new Date(now.getTime() + SETUP_LIFETIME_MS);
}

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

function isSerializableConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2034";
}

async function withSerializableRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isSerializableConflict(error) || attempt >= 3) throw error;
    }
  }
}

export async function startInitialTwoFactorBootstrap(input: {
  primary: PrimaryAuthContext;
  now?: Date;
}): Promise<TotpEnrollmentView> {
  const now = input.now ?? new Date();
  const authSessionHash = hashNeonSessionId(input.primary.sessionId);
  const config = readTwoFactorConfig();

  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const currentUser = await tx.appUser.findUnique({
          where: { id: input.primary.appUser.id },
          select: {
            id: true,
            active: true,
            username: true,
            twoFactorResetAt: true,
            role: true,
            name: true,
            email: true,
          },
        });
        if (
          !currentUser?.active
          || !currentUser.username
          || (currentUser.twoFactorResetAt
            && input.primary.sessionCreatedAt <= currentUser.twoFactorResetAt)
        ) {
          throw new InitialTwoFactorBootstrapUnavailableError();
        }

        const firstActiveAdmin = await tx.appUser.findFirst({
          where: { role: "ADMIN", active: true, username: { not: null } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        const activeCredentialCount = await tx.twoFactorCredential.count({
          where: { status: "ACTIVE" },
        });
        const securityState = await tx.applicationSecurityState.findUnique({
          where: { id: APPLICATION_SECURITY_STATE_ID },
          select: { twoFactorBootstrapCompletedAt: true },
        });
        const currentCredential = await tx.twoFactorCredential.findUnique({
          where: { appUserId: currentUser.id },
          select: {
            status: true,
            setupExpiresAt: true,
            enrollmentAuthSessionHash: true,
          },
        });
        const hasForeignLivePendingCredential = Boolean(
          currentCredential?.status === "PENDING"
            && currentCredential.setupExpiresAt
            && currentCredential.setupExpiresAt > now
            && currentCredential.enrollmentAuthSessionHash
            && currentCredential.enrollmentAuthSessionHash !== authSessionHash,
        );

        if (
          !isInitialTwoFactorBootstrapEligible({
            currentUser,
            firstActiveAdminId: firstActiveAdmin?.id ?? null,
            activeCredentialCount,
            bootstrapCompletedAt:
              securityState?.twoFactorBootstrapCompletedAt ?? null,
            hasForeignLivePendingCredential,
          })
        ) {
          throw new InitialTwoFactorBootstrapUnavailableError();
        }

        const generated = createTotpEnrollment(currentUser.username);
        const expiresAt = bootstrapSetupExpiry(now);
        await tx.twoFactorCredential.deleteMany({
          where: { appUserId: currentUser.id, status: "PENDING" },
        });
        const created = await tx.twoFactorCredential.create({
          data: {
            appUserId: currentUser.id,
            status: "PENDING",
            encryptedSecret: encryptTotpSecret(
              generated.secret,
              config.encryptionKey,
            ),
            setupExpiresAt: expiresAt,
            enrollmentAuthSessionHash: hashNeonSessionId(input.primary.sessionId),
          },
          select: { id: true },
        });
        await logAuditRequired(tx, currentUser, {
          action: "UPDATE",
          entity: "TwoFactorCredential",
          entityId: created.id,
          summary: `Bootstrap 2FA inițiat pentru ${currentUser.username}`,
          details: { event: "TWO_FACTOR_BOOTSTRAP_STARTED" },
        });

        return {
          credentialId: created.id,
          secret: generated.secret,
          uri: generated.uri,
          expiresAt,
        };
      },
      { isolationLevel: "Serializable" },
    ),
  );
}
