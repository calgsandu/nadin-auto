import { timingSafeEqual } from "node:crypto";
import type { TwoFactorCredentialStatus } from "@/generated/prisma/enums";
import { logAuditRequired } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { normalizeEnrollmentActivationCode } from "./activation-code";
import { readTwoFactorConfig } from "./config";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  hashEnrollmentActivationCode,
  hashNeonSessionId,
} from "./crypto";
import { consumeEnrollmentGrant } from "./enrollment-grant";
import {
  assertTwoFactorAttemptAllowed,
  buildRateLimitKeys,
  clearUserSessionRateLimit,
  recordTwoFactorFailure,
} from "./rate-limit";
import { issueSessionProof, issueTrustedDevice } from "./session";
import { createTotpEnrollment, createTotpUri, matchTotpStep } from "./totp";
import type { PrimaryAuthContext } from "./types";
import { getInitialTwoFactorBootstrapEligibility } from "./bootstrap";

const SETUP_LIFETIME_MS = 15 * 60_000;

type PendingCredential = {
  status: TwoFactorCredentialStatus;
  setupExpiresAt: Date | null;
  enrollmentAuthSessionHash: string | null;
};

export type EnrollmentSetupState =
  | { kind: "ACTIVATION_REQUIRED" }
  | { kind: "BOOTSTRAP_AVAILABLE" }
  | { kind: "READY"; enrollment: TotpEnrollmentView };

export type TotpEnrollmentView = {
  credentialId: string;
  secret: string;
  uri: string;
  expiresAt: Date;
};

export class InvalidTotpCodeError extends Error {
  constructor(message = "Codul nu este valid sau a expirat.") {
    super(message);
    this.name = "InvalidTotpCodeError";
  }
}

export class InvalidEnrollmentActivationCodeError extends Error {
  constructor(message = "Codul de activare nu este valid sau a expirat.") {
    super(message);
    this.name = "InvalidEnrollmentActivationCodeError";
  }
}

function hashesEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.byteLength === rightBuffer.byteLength
    && timingSafeEqual(leftBuffer, rightBuffer);
}

export function resolveEnrollmentSetupKind(
  credential: PendingCredential | null,
  authSessionHash: string,
  now: Date,
  bootstrapEligible = false,
) {
  if (!credential) {
    return bootstrapEligible
      ? "BOOTSTRAP_AVAILABLE" as const
      : "ACTIVATION_REQUIRED" as const;
  }
  if (credential.status === "ACTIVE") return "REJECT_ACTIVE" as const;
  const ready = credential.setupExpiresAt
    && credential.setupExpiresAt > now
    && credential.enrollmentAuthSessionHash
    && hashesEqual(credential.enrollmentAuthSessionHash, authSessionHash);
  if (ready) return "READY" as const;
  return bootstrapEligible
    ? "BOOTSTRAP_AVAILABLE" as const
    : "ACTIVATION_REQUIRED" as const;
}

function requireUsername(primary: PrimaryAuthContext) {
  const username = primary.appUser.username;
  if (!username) {
    throw new Error(
      "Contul nu are un nume de utilizator configurat. Contactează administratorul.",
    );
  }
  return username;
}

function enrollmentView(
  credential: { id: string; encryptedSecret: string; setupExpiresAt: Date | null },
  username: string,
) {
  if (!credential.setupExpiresAt) {
    throw new Error("Configurarea Authenticator nu mai este disponibilă.");
  }
  const secret = decryptTotpSecret(
    credential.encryptedSecret,
    readTwoFactorConfig().encryptionKey,
  );
  return {
    credentialId: credential.id,
    secret,
    uri: createTotpUri(secret, username),
    expiresAt: credential.setupExpiresAt,
  };
}

export async function getEnrollmentSetupState(
  primary: PrimaryAuthContext,
  now = new Date(),
): Promise<EnrollmentSetupState> {
  const username = requireUsername(primary);
  const authSessionHash = hashNeonSessionId(primary.sessionId);
  const current = await prisma.twoFactorCredential.findUnique({
    where: { appUserId: primary.appUser.id },
    select: {
      id: true,
      status: true,
      setupExpiresAt: true,
      enrollmentAuthSessionHash: true,
    },
  });
  let decision = resolveEnrollmentSetupKind(current, authSessionHash, now);
  if (decision === "REJECT_ACTIVE") {
    throw new Error("Authenticator este deja configurat pentru acest cont.");
  }
  if (decision === "ACTIVATION_REQUIRED") {
    const hasForeignLivePendingCredential = Boolean(
      current?.status === "PENDING"
        && current.setupExpiresAt
        && current.setupExpiresAt > now
        && current.enrollmentAuthSessionHash
        && !hashesEqual(current.enrollmentAuthSessionHash, authSessionHash),
    );
    const bootstrapEligible = await getInitialTwoFactorBootstrapEligibility(
      primary,
      hasForeignLivePendingCredential,
    );
    decision = resolveEnrollmentSetupKind(
      current,
      authSessionHash,
      now,
      bootstrapEligible,
    );
  }
  if (decision === "BOOTSTRAP_AVAILABLE") {
    return { kind: "BOOTSTRAP_AVAILABLE" };
  }
  if (decision === "ACTIVATION_REQUIRED" || !current) {
    return { kind: "ACTIVATION_REQUIRED" };
  }

  const authorized = await prisma.twoFactorCredential.findFirst({
    where: {
      id: current.id,
      appUserId: primary.appUser.id,
      status: "PENDING",
      setupExpiresAt: { gt: now },
      enrollmentAuthSessionHash: authSessionHash,
    },
    select: { id: true, encryptedSecret: true, setupExpiresAt: true },
  });
  if (!authorized) {
    return { kind: "ACTIVATION_REQUIRED" };
  }
  return { kind: "READY", enrollment: enrollmentView(authorized, username) };
}

export async function startPendingEnrollmentWithActivationCode(input: {
  primary: PrimaryAuthContext;
  activationCode: string;
  ip: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const currentUser = await prisma.appUser.findUnique({
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
  const username = currentUser.username;

  const config = readTwoFactorConfig();
  const rateLimitKeys = buildRateLimitKeys(
    currentUser.id,
    input.primary.sessionId,
    input.ip,
    config.rateLimitPepper,
  );
  await assertTwoFactorAttemptAllowed(rateLimitKeys, now);

  let normalizedCode: string;
  try {
    normalizedCode = normalizeEnrollmentActivationCode(input.activationCode);
  } catch {
    await recordTwoFactorFailure(rateLimitKeys, now);
    throw new InvalidEnrollmentActivationCodeError();
  }

  let enrollment: TotpEnrollmentView;
  try {
    enrollment = await prisma.$transaction(async (tx) => {
      const consumed = await consumeEnrollmentGrant(tx, {
        appUserId: currentUser.id,
        tokenHash: hashEnrollmentActivationCode(normalizedCode),
        now,
      });
      if (!consumed) throw new InvalidEnrollmentActivationCodeError();

      const generated = createTotpEnrollment(username);
      const expiresAt = new Date(now.getTime() + SETUP_LIFETIME_MS);
      await tx.twoFactorCredential.deleteMany({
        where: { appUserId: currentUser.id, status: "PENDING" },
      });
      const created = await tx.twoFactorCredential.create({
        data: {
          appUserId: currentUser.id,
          status: "PENDING",
          encryptedSecret: encryptTotpSecret(generated.secret, config.encryptionKey),
          setupExpiresAt: expiresAt,
          enrollmentAuthSessionHash: hashNeonSessionId(input.primary.sessionId),
        },
        select: { id: true },
      });
      await logAuditRequired(tx, currentUser, {
        action: "UPDATE",
        entity: "TwoFactorCredential",
        entityId: created.id,
        summary: `Codul de activare 2FA pentru ${username} a fost consumat`,
        details: { event: "TWO_FACTOR_ENROLLMENT_GRANT_CONSUMED" },
      });
      return {
        credentialId: created.id,
        secret: generated.secret,
        uri: generated.uri,
        expiresAt,
      };
    });
  } catch (error) {
    if (error instanceof InvalidEnrollmentActivationCodeError) {
      await recordTwoFactorFailure(rateLimitKeys, now);
    }
    throw error;
  }

  const userSessionKey = rateLimitKeys.find(({ scope }) => scope === "USER_SESSION");
  if (userSessionKey) await clearUserSessionRateLimit(userSessionKey);
  return enrollment;
}

export async function regeneratePendingEnrollment(
  primary: PrimaryAuthContext,
  now = new Date(),
) {
  const username = requireUsername(primary);
  const current = await prisma.twoFactorCredential.findUnique({
    where: { appUserId: primary.appUser.id },
    select: {
      id: true,
      status: true,
      setupExpiresAt: true,
      enrollmentAuthSessionHash: true,
    },
  });
  const authSessionHash = hashNeonSessionId(primary.sessionId);
  if (
    !current
    || resolveEnrollmentSetupKind(current, authSessionHash, now) !== "READY"
    || !current.setupExpiresAt
  ) {
    throw new Error("Nu există o configurare Authenticator în curs.");
  }

  const generated = createTotpEnrollment(username);
  const changed = await prisma.twoFactorCredential.updateMany({
    where: {
      id: current.id,
      appUserId: primary.appUser.id,
      status: "PENDING",
      setupExpiresAt: { gt: now },
      enrollmentAuthSessionHash: authSessionHash,
    },
    data: {
      encryptedSecret: encryptTotpSecret(
        generated.secret,
        readTwoFactorConfig().encryptionKey,
      ),
    },
  });
  if (changed.count !== 1) {
    throw new Error("Configurarea Authenticator s-a schimbat. Reîncarcă pagina.");
  }
  return {
    credentialId: current.id,
    secret: generated.secret,
    uri: generated.uri,
    expiresAt: current.setupExpiresAt,
  };
}

export async function confirmPendingEnrollment(input: {
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
  const authSessionHash = hashNeonSessionId(input.primary.sessionId);

  const credential = await prisma.twoFactorCredential.findFirst({
    where: {
      id: input.credentialId,
      appUserId: input.primary.appUser.id,
      status: "PENDING",
      enrollmentAuthSessionHash: authSessionHash,
    },
  });
  if (!credential?.setupExpiresAt || credential.setupExpiresAt <= now) {
    throw new InvalidTotpCodeError(
      "Configurarea a expirat. Cere administratorului un cod de activare nou.",
    );
  }

  const secret = decryptTotpSecret(credential.encryptedSecret, config.encryptionKey);
  const step = matchTotpStep(secret, currentUser.username, input.code, now.getTime());
  if (step === null) {
    await recordTwoFactorFailure(rateLimitKeys, now);
    throw new InvalidTotpCodeError();
  }

  await prisma.$transaction(async (tx) => {
    const activated = await tx.twoFactorCredential.updateMany({
      where: {
        id: credential.id,
        appUserId: input.primary.appUser.id,
        status: "PENDING",
        setupExpiresAt: { gt: now },
        enrollmentAuthSessionHash: authSessionHash,
      },
      data: {
        status: "ACTIVE",
        verifiedAt: now,
        setupExpiresAt: null,
        lastAcceptedStep: BigInt(step),
        enrollmentAuthSessionHash: null,
      },
    });
    if (activated.count !== 1) {
      throw new InvalidTotpCodeError("Configurarea s-a schimbat. Reîncarcă pagina.");
    }
    await logAuditRequired(tx, currentUser, {
      action: "UPDATE",
      entity: "TwoFactorCredential",
      entityId: credential.id,
      summary: `Authenticator activat pentru ${currentUser.username}`,
      details: { event: "TWO_FACTOR_ENROLLMENT_ACTIVATED" },
    });
  });

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
