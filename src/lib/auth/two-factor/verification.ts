import { prisma } from "@/lib/prisma";
import { readTwoFactorConfig } from "./config";
import { decryptTotpSecret } from "./crypto";
import { InvalidTotpCodeError } from "./enrollment";
import {
  assertTwoFactorAttemptAllowed,
  buildRateLimitKeys,
  clearUserSessionRateLimit,
  recordTwoFactorFailure,
} from "./rate-limit";
import { issueSessionProof, issueTrustedDevice } from "./session";
import { matchTotpStep } from "./totp";
import type { PrimaryAuthContext } from "./types";

export function canConsumeTotpStep(lastAcceptedStep: bigint | null, step: number) {
  return lastAcceptedStep === null || BigInt(step) > lastAcceptedStep;
}

export async function verifyActiveTotp(input: {
  primary: PrimaryAuthContext;
  credentialId: string;
  code: string;
  rememberDevice: boolean;
  ip: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const currentUser = await prisma.appUser.findUnique({
    where: { id: input.primary.appUser.id },
    select: { active: true, username: true, twoFactorResetAt: true },
  });
  if (
    !currentUser?.active
    || (currentUser.twoFactorResetAt
      && input.primary.sessionCreatedAt <= currentUser.twoFactorResetAt)
  ) {
    throw new Error("Sesiunea trebuie autentificată din nou.");
  }
  if (!currentUser.username) {
    throw new Error(
      "Contul nu are un nume de utilizator configurat. Contactează administratorul.",
    );
  }

  const config = readTwoFactorConfig();
  const rateLimitKeys = buildRateLimitKeys(
    input.primary.appUser.id,
    input.primary.sessionId,
    input.ip,
    config.rateLimitPepper,
  );
  await assertTwoFactorAttemptAllowed(rateLimitKeys, now);

  const credential = await prisma.twoFactorCredential.findFirst({
    where: {
      id: input.credentialId,
      appUserId: input.primary.appUser.id,
      status: "ACTIVE",
    },
  });
  if (!credential) throw new InvalidTotpCodeError();

  const secret = decryptTotpSecret(credential.encryptedSecret, config.encryptionKey);
  const step = matchTotpStep(secret, currentUser.username, input.code, now.getTime());
  if (step === null || !canConsumeTotpStep(credential.lastAcceptedStep, step)) {
    await recordTwoFactorFailure(rateLimitKeys, now);
    throw new InvalidTotpCodeError();
  }

  const consumed = await prisma.$transaction((tx) =>
    tx.twoFactorCredential.updateMany({
      where: {
        id: credential.id,
        appUserId: input.primary.appUser.id,
        status: "ACTIVE",
        OR: [
          { lastAcceptedStep: null },
          { lastAcceptedStep: { lt: BigInt(step) } },
        ],
      },
      data: { lastAcceptedStep: BigInt(step) },
    }),
  );
  if (consumed.count !== 1) {
    await recordTwoFactorFailure(rateLimitKeys, now);
    throw new InvalidTotpCodeError();
  }

  const proof = await issueSessionProof({
    appUserId: input.primary.appUser.id,
    credentialId: credential.id,
    authSessionId: input.primary.sessionId,
    sessionExpiresAt: input.primary.sessionExpiresAt,
    now,
  });
  const trusted = input.rememberDevice
    ? await issueTrustedDevice({
        appUserId: input.primary.appUser.id,
        credentialId: credential.id,
        now,
      })
    : null;
  const userSessionKey = rateLimitKeys.find(({ scope }) => scope === "USER_SESSION");
  if (userSessionKey) await clearUserSessionRateLimit(userSessionKey);

  return {
    proofToken: proof.rawToken,
    proofExpiresAt: proof.expiresAt,
    trustedToken: trusted?.rawToken,
    trustedExpiresAt: trusted?.expiresAt,
  };
}
