import { isIP } from "node:net";
import { Prisma } from "@/generated/prisma/client";
import type { TwoFactorRateLimitScope } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hashNeonSessionId, hashRateLimitIp, hashToken } from "./crypto";

export type RateLimitPolicy = {
  maximum: number;
  windowMs: number;
  blockMs: number;
};

export type RateLimitState = {
  failures: number;
  windowStarted: Date;
  blockedUntil: Date | null;
};

export type RateLimitKey = {
  scope: TwoFactorRateLimitScope;
  keyHash: string;
};

export const USER_SESSION_POLICY = {
  maximum: 5,
  windowMs: 10 * 60_000,
  blockMs: 15 * 60_000,
} as const;

export const IP_POLICY = {
  maximum: 25,
  windowMs: 10 * 60_000,
  blockMs: 15 * 60_000,
} as const;

export class TwoFactorLockedError extends Error {
  readonly retryAt: Date;

  constructor(retryAt: Date) {
    super("Prea multe încercări. Încearcă din nou mai târziu.");
    this.name = "TwoFactorLockedError";
    this.retryAt = retryAt;
  }
}

export function nextFailureState(
  current: RateLimitState | null,
  now: Date,
  policy: RateLimitPolicy,
): RateLimitState {
  if (!current || now.getTime() - current.windowStarted.getTime() >= policy.windowMs) {
    return { failures: 1, windowStarted: now, blockedUntil: null };
  }

  const failures = current.failures + 1;
  return {
    failures,
    windowStarted: current.windowStarted,
    blockedUntil:
      failures >= policy.maximum
        ? new Date(now.getTime() + policy.blockMs)
        : current.blockedUntil,
  };
}

export function rateLimitDecision(state: RateLimitState | null, now: Date) {
  const retryAt = state?.blockedUntil ?? null;
  return retryAt && retryAt.getTime() > now.getTime()
    ? { allowed: false as const, retryAt }
    : { allowed: true as const, retryAt: null };
}

export function buildRateLimitKeys(
  userId: string,
  sessionId: string,
  ip: string | null,
  pepper: Buffer,
) {
  const keys: RateLimitKey[] = [
    {
      scope: "USER_SESSION",
      keyHash: hashToken(
        `rate:user-session:${userId}:${hashNeonSessionId(sessionId)}`,
      ),
    },
  ];
  if (ip) {
    keys.push({ scope: "IP", keyHash: hashRateLimitIp(ip, pepper) });
  }
  return keys;
}

function policyFor(scope: TwoFactorRateLimitScope) {
  return scope === "IP" ? IP_POLICY : USER_SESSION_POLICY;
}

function latestDate(dates: Array<Date | null>) {
  return dates.reduce<Date | null>((latest, date) => {
    if (!date) return latest;
    return !latest || date > latest ? date : latest;
  }, null);
}

export async function assertTwoFactorAttemptAllowed(
  keys: RateLimitKey[],
  now = new Date(),
) {
  if (keys.length === 0) return;
  const states = await prisma.twoFactorRateLimit.findMany({
    where: {
      OR: keys.map((key) => ({ scope: key.scope, keyHash: key.keyHash })),
    },
    select: { failures: true, windowStarted: true, blockedUntil: true },
  });
  const blockedUntil = latestDate(
    states.map((state) => rateLimitDecision(state, now).retryAt),
  );
  if (blockedUntil) throw new TwoFactorLockedError(blockedUntil);
}

function isSerializableConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
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

export async function recordTwoFactorFailure(
  keys: RateLimitKey[],
  now = new Date(),
) {
  if (keys.length === 0) return null;
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const blockedUntil: Array<Date | null> = [];
        for (const key of keys) {
          const current = await tx.twoFactorRateLimit.findUnique({
            where: { scope_keyHash: { scope: key.scope, keyHash: key.keyHash } },
            select: { failures: true, windowStarted: true, blockedUntil: true },
          });
          const next = nextFailureState(current, now, policyFor(key.scope));
          await tx.twoFactorRateLimit.upsert({
            where: { scope_keyHash: { scope: key.scope, keyHash: key.keyHash } },
            create: {
              scope: key.scope,
              keyHash: key.keyHash,
              failures: next.failures,
              windowStarted: next.windowStarted,
              blockedUntil: next.blockedUntil,
            },
            update: {
              failures: next.failures,
              windowStarted: next.windowStarted,
              blockedUntil: next.blockedUntil,
            },
          });
          blockedUntil.push(next.blockedUntil);
        }
        return latestDate(blockedUntil);
      },
      { isolationLevel: "Serializable" },
    ),
  );
}

export async function clearUserSessionRateLimit(key: RateLimitKey) {
  if (key.scope !== "USER_SESSION") return;
  await prisma.twoFactorRateLimit.deleteMany({
    where: { scope: key.scope, keyHash: key.keyHash },
  });
}

export async function cleanupExpiredRateLimits(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 24 * 60 * 60_000);
  const stale = await prisma.twoFactorRateLimit.findMany({
    where: {
      updatedAt: { lt: staleBefore },
      OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
  if (stale.length === 0) return 0;
  const result = await prisma.twoFactorRateLimit.deleteMany({
    where: { id: { in: stale.map(({ id }) => id) } },
  });
  return result.count;
}

function normalizeFirstIp(value: string | null) {
  const candidate = value?.split(",", 1)[0]?.trim().toLowerCase() ?? "";
  if (!candidate) return null;
  if (isIP(candidate)) return candidate;

  const bracketed = candidate.match(/^\[([^\]]+)](?::\d+)?$/)?.[1];
  if (bracketed && isIP(bracketed)) return bracketed;

  const ipv4WithPort = candidate.match(/^([^:]+):\d+$/)?.[1];
  return ipv4WithPort && isIP(ipv4WithPort) === 4 ? ipv4WithPort : null;
}

export function trustedClientIp(
  headers: Pick<Headers, "get">,
  env: Record<string, string | undefined> = process.env,
) {
  if (env.VERCEL === "1") {
    return normalizeFirstIp(headers.get("x-vercel-forwarded-for"));
  }
  if (env.NODE_ENV !== "production") {
    return normalizeFirstIp(headers.get("x-forwarded-for"));
  }
  return null;
}
