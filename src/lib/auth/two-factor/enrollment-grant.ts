import {
  enrollmentActivationExpiry,
  generateEnrollmentActivationCode,
  normalizeEnrollmentActivationCode,
} from "./activation-code";
import { hashEnrollmentActivationCode } from "./crypto";

type EnrollmentGrantWhere = {
  appUserId: string;
  tokenHash?: string;
  expiresAt?: { gt: Date };
};

type EnrollmentGrantCleanupClient = {
  twoFactorEnrollmentGrant: {
    deleteMany(args: { where: EnrollmentGrantWhere }): Promise<{ count: number }>;
  };
};

export type EnrollmentGrantClient = EnrollmentGrantCleanupClient & {
  twoFactorEnrollmentGrant: EnrollmentGrantCleanupClient["twoFactorEnrollmentGrant"] & {
    create(args: {
      data: { appUserId: string; tokenHash: string; expiresAt: Date };
    }): Promise<unknown>;
  };
  twoFactorCredential: {
    deleteMany(args: {
      where: { appUserId: string; status: "PENDING" };
    }): Promise<{ count: number }>;
  };
};

export async function clearEnrollmentGrant(
  tx: EnrollmentGrantCleanupClient,
  appUserId: string,
) {
  await tx.twoFactorEnrollmentGrant.deleteMany({ where: { appUserId } });
}

export async function replaceEnrollmentGrant(
  tx: EnrollmentGrantClient,
  appUserId: string,
  now: Date,
  rawCode = generateEnrollmentActivationCode(),
) {
  const normalizedCode = normalizeEnrollmentActivationCode(rawCode);
  const code = normalizedCode.match(/.{4}/g)!.join("-");
  const expiresAt = enrollmentActivationExpiry(now);

  await clearEnrollmentGrant(tx, appUserId);
  await tx.twoFactorCredential.deleteMany({
    where: { appUserId, status: "PENDING" },
  });
  await tx.twoFactorEnrollmentGrant.create({
    data: {
      appUserId,
      tokenHash: hashEnrollmentActivationCode(normalizedCode),
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function consumeEnrollmentGrant(
  tx: EnrollmentGrantCleanupClient,
  input: { appUserId: string; tokenHash: string; now: Date },
) {
  const consumed = await tx.twoFactorEnrollmentGrant.deleteMany({
    where: {
      appUserId: input.appUserId,
      tokenHash: input.tokenHash,
      expiresAt: { gt: input.now },
    },
  });
  return consumed.count === 1;
}
