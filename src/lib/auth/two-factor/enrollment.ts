import { Prisma } from "@/generated/prisma/client";
import type { TwoFactorCredentialStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { readTwoFactorConfig } from "./config";
import { decryptTotpSecret, encryptTotpSecret } from "./crypto";
import {
  assertTwoFactorAttemptAllowed,
  buildRateLimitKeys,
  clearUserSessionRateLimit,
  recordTwoFactorFailure,
} from "./rate-limit";
import { issueSessionProof, issueTrustedDevice } from "./session";
import { createTotpEnrollment, createTotpUri, matchTotpStep } from "./totp";
import type { PrimaryAuthContext } from "./types";

const SETUP_LIFETIME_MS = 15 * 60_000;

type PendingCredential = {
  status: TwoFactorCredentialStatus;
  setupExpiresAt: Date | null;
};

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

export function decidePendingEnrollment(
  credential: PendingCredential | null,
  now: Date,
) {
  if (!credential) return "CREATE" as const;
  if (credential.status === "ACTIVE") return "REJECT_ACTIVE" as const;
  return credential.setupExpiresAt && credential.setupExpiresAt > now
    ? "REUSE" as const
    : "REPLACE" as const;
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

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
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

export async function getOrCreatePendingEnrollment(
  primary: PrimaryAuthContext,
  now = new Date(),
  retry = 0,
): Promise<TotpEnrollmentView> {
  const username = requireUsername(primary);
  const current = await prisma.twoFactorCredential.findUnique({
    where: { appUserId: primary.appUser.id },
    select: {
      id: true,
      status: true,
      encryptedSecret: true,
      setupExpiresAt: true,
    },
  });
  const decision = decidePendingEnrollment(current, now);
  if (decision === "REJECT_ACTIVE") {
    throw new Error("Authenticator este deja configurat pentru acest cont.");
  }
  if (decision === "REUSE" && current) {
    return enrollmentView(current, username);
  }

  const generated = createTotpEnrollment(username);
  const expiresAt = new Date(now.getTime() + SETUP_LIFETIME_MS);
  const encryptedSecret = encryptTotpSecret(
    generated.secret,
    readTwoFactorConfig().encryptionKey,
  );

  if (decision === "CREATE") {
    try {
      const created = await prisma.twoFactorCredential.create({
        data: {
          appUserId: primary.appUser.id,
          status: "PENDING",
          encryptedSecret,
          setupExpiresAt: expiresAt,
        },
        select: { id: true, encryptedSecret: true, setupExpiresAt: true },
      });
      return enrollmentView(created, username);
    } catch (error) {
      if (!isUniqueConflict(error) || retry >= 1) throw error;
      return getOrCreatePendingEnrollment(primary, now, retry + 1);
    }
  }

  if (!current) throw new Error("Configurarea Authenticator nu mai este disponibilă.");
  const replaced = await prisma.twoFactorCredential.updateMany({
    where: {
      id: current.id,
      appUserId: primary.appUser.id,
      status: "PENDING",
      OR: [{ setupExpiresAt: null }, { setupExpiresAt: { lte: now } }],
    },
    data: { encryptedSecret, setupExpiresAt: expiresAt },
  });
  if (replaced.count !== 1) {
    if (retry >= 1) throw new Error("Configurarea Authenticator s-a schimbat. Reîncarcă pagina.");
    return getOrCreatePendingEnrollment(primary, now, retry + 1);
  }
  return {
    credentialId: current.id,
    secret: generated.secret,
    uri: generated.uri,
    expiresAt,
  };
}

export async function regeneratePendingEnrollment(
  primary: PrimaryAuthContext,
  now = new Date(),
) {
  const username = requireUsername(primary);
  const current = await prisma.twoFactorCredential.findUnique({
    where: { appUserId: primary.appUser.id },
    select: { id: true, status: true },
  });
  if (!current || current.status !== "PENDING") {
    throw new Error("Nu există o configurare Authenticator în curs.");
  }

  const generated = createTotpEnrollment(username);
  const expiresAt = new Date(now.getTime() + SETUP_LIFETIME_MS);
  const changed = await prisma.twoFactorCredential.updateMany({
    where: { id: current.id, appUserId: primary.appUser.id, status: "PENDING" },
    data: {
      encryptedSecret: encryptTotpSecret(
        generated.secret,
        readTwoFactorConfig().encryptionKey,
      ),
      setupExpiresAt: expiresAt,
    },
  });
  if (changed.count !== 1) {
    throw new Error("Configurarea Authenticator s-a schimbat. Reîncarcă pagina.");
  }
  return {
    credentialId: current.id,
    secret: generated.secret,
    uri: generated.uri,
    expiresAt,
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
      status: "PENDING",
    },
  });
  if (!credential?.setupExpiresAt || credential.setupExpiresAt <= now) {
    throw new InvalidTotpCodeError("Configurarea a expirat. Generează o cheie nouă.");
  }

  const secret = decryptTotpSecret(credential.encryptedSecret, config.encryptionKey);
  const step = matchTotpStep(secret, currentUser.username, input.code, now.getTime());
  if (step === null) {
    await recordTwoFactorFailure(rateLimitKeys, now);
    throw new InvalidTotpCodeError();
  }

  const activated = await prisma.$transaction((tx) =>
    tx.twoFactorCredential.updateMany({
      where: {
        id: credential.id,
        appUserId: input.primary.appUser.id,
        status: "PENDING",
        setupExpiresAt: { gt: now },
      },
      data: {
        status: "ACTIVE",
        verifiedAt: now,
        setupExpiresAt: null,
        lastAcceptedStep: BigInt(step),
      },
    }),
  );
  if (activated.count !== 1) {
    throw new InvalidTotpCodeError("Configurarea s-a schimbat. Reîncarcă pagina.");
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
