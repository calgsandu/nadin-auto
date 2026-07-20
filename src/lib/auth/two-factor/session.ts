import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readTwoFactorConfig } from "./config";
import {
  generateOpaqueToken,
  hashNeonSessionId,
  hashToken,
} from "./crypto";

const TRUSTED_DEVICE_MS = 30 * 24 * 60 * 60_000;

export type TrustedDeviceRotationStore = {
  rotate(input: {
    presentedTokenHash: string;
    replacementTokenHash: string;
    appUserId: string;
    credentialId: string;
    now: Date;
    replacementExpiresAt: Date;
  }): Promise<boolean>;
};

type ProofBinding = {
  rawToken: string;
  appUserId: string;
  credentialId: string;
  authSessionId: string;
  now: Date;
};

type StoredProofBinding = {
  tokenHash: string;
  appUserId: string;
  credentialId: string;
  authSessionHash: string;
  expiresAt: Date;
};

function equalHash(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function sessionProofMatches(
  proof: StoredProofBinding,
  input: ProofBinding,
) {
  return (
    equalHash(proof.tokenHash, hashToken(input.rawToken))
    && proof.appUserId === input.appUserId
    && proof.credentialId === input.credentialId
    && equalHash(proof.authSessionHash, hashNeonSessionId(input.authSessionId))
    && proof.expiresAt.getTime() > input.now.getTime()
  );
}

export async function issueSessionProof(input: {
  appUserId: string;
  credentialId: string;
  authSessionId: string;
  sessionExpiresAt: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.sessionExpiresAt.getTime() <= now.getTime()) {
    throw new Error("Sesiunea de autentificare a expirat.");
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);
  const authSessionHash = hashNeonSessionId(input.authSessionId);
  await prisma.$transaction(async (tx) => {
    await tx.twoFactorSessionProof.deleteMany({ where: { authSessionHash } });
    await tx.twoFactorSessionProof.create({
      data: {
        appUserId: input.appUserId,
        credentialId: input.credentialId,
        tokenHash,
        authSessionHash,
        expiresAt: input.sessionExpiresAt,
      },
    });
  });
  return { rawToken, expiresAt: input.sessionExpiresAt };
}

export async function issueTrustedDevice(input: {
  appUserId: string;
  credentialId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const rawToken = generateOpaqueToken();
  const expiresAt = trustedDeviceExpiry(now);
  await prisma.trustedDevice.create({
    data: {
      appUserId: input.appUserId,
      credentialId: input.credentialId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      lastUsedAt: now,
    },
  });
  return { rawToken, expiresAt };
}

export function trustedDeviceExpiry(now: Date) {
  return new Date(now.getTime() + TRUSTED_DEVICE_MS);
}

export function trustedDeviceMatches(
  device: {
    tokenHash: string;
    appUserId: string;
    credentialId: string;
    expiresAt: Date;
  },
  input: {
    rawToken: string;
    appUserId: string;
    credentialId: string;
    now: Date;
  },
) {
  return (
    equalHash(device.tokenHash, hashToken(input.rawToken))
    && device.appUserId === input.appUserId
    && device.credentialId === input.credentialId
    && device.expiresAt.getTime() > input.now.getTime()
  );
}

const prismaTrustedDeviceRotationStore: TrustedDeviceRotationStore = {
  async rotate(input) {
    return prisma.$transaction(async (tx) => {
      const consumed = await tx.trustedDevice.deleteMany({
        where: {
          tokenHash: input.presentedTokenHash,
          appUserId: input.appUserId,
          credentialId: input.credentialId,
          expiresAt: { gt: input.now },
        },
      });
      if (consumed.count !== 1) return false;
      await tx.trustedDevice.create({
        data: {
          tokenHash: input.replacementTokenHash,
          appUserId: input.appUserId,
          credentialId: input.credentialId,
          expiresAt: input.replacementExpiresAt,
          lastUsedAt: input.now,
        },
      });
      return true;
    });
  },
};

export async function consumeAndRotateTrustedDevice(
  input: {
    rawToken: string;
    appUserId: string;
    credentialId: string;
    now?: Date;
  },
  store: TrustedDeviceRotationStore = prismaTrustedDeviceRotationStore,
) {
  const now = input.now ?? new Date();
  const rawToken = generateOpaqueToken();
  const expiresAt = trustedDeviceExpiry(now);
  const rotated = await store.rotate({
    presentedTokenHash: hashToken(input.rawToken),
    replacementTokenHash: hashToken(rawToken),
    appUserId: input.appUserId,
    credentialId: input.credentialId,
    now,
    replacementExpiresAt: expiresAt,
  });
  return rotated ? { rawToken, expiresAt } : null;
}

export function twoFactorCookieOptions(expiresAt: Date) {
  const config = readTwoFactorConfig();
  return {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function validateSessionProof(input: ProofBinding) {
  const proof = await prisma.twoFactorSessionProof.findFirst({
    where: {
      tokenHash: hashToken(input.rawToken),
      authSessionHash: hashNeonSessionId(input.authSessionId),
      appUserId: input.appUserId,
      credentialId: input.credentialId,
      expiresAt: { gt: input.now },
    },
    select: {
      tokenHash: true,
      authSessionHash: true,
      appUserId: true,
      credentialId: true,
      expiresAt: true,
    },
  });
  return proof ? sessionProofMatches(proof, input) : false;
}
