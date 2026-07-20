import { cookies } from "next/headers";
import type { TwoFactorCredentialStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { readTwoFactorConfig } from "./config";
import { readPrimaryAuthResult } from "./primary";
import { validateSessionProof } from "./session";
import type { AuthAccessState } from "./types";

type ResolveAccessInput = {
  primary: { sessionCreatedAt: Date } | null;
  resetAt: Date | null;
  credentialStatus: TwoFactorCredentialStatus | null;
  proofValid: boolean;
};

export function resolveAccessKind(input: ResolveAccessInput): AuthAccessState["kind"] {
  if (!input.primary) return "UNAUTHENTICATED";
  if (
    input.resetAt
    && input.primary.sessionCreatedAt.getTime() <= input.resetAt.getTime()
  ) {
    return "UNAUTHENTICATED";
  }
  if (!input.credentialStatus || input.credentialStatus === "PENDING") {
    return "ENROLLMENT_REQUIRED";
  }
  return input.proofValid ? "AUTHENTICATED" : "TOTP_REQUIRED";
}

export async function getAuthAccessState(): Promise<AuthAccessState> {
  const primaryResult = await readPrimaryAuthResult();
  if (!primaryResult.primary) {
    return { kind: "UNAUTHENTICATED", reason: primaryResult.reason };
  }

  const primary = primaryResult.primary;
  if (
    primary.appUser.twoFactorResetAt
    && primary.sessionCreatedAt.getTime() <= primary.appUser.twoFactorResetAt.getTime()
  ) {
    return { kind: "UNAUTHENTICATED", reason: "STALE_AFTER_RESET" };
  }

  const credential = await prisma.twoFactorCredential.findUnique({
    where: { appUserId: primary.appUser.id },
    select: { id: true, status: true },
  });
  if (!credential || credential.status === "PENDING") {
    return {
      kind: "ENROLLMENT_REQUIRED",
      primary,
      pendingCredentialId: credential?.id ?? null,
    };
  }

  const config = readTwoFactorConfig();
  const rawToken = (await cookies()).get(config.proofCookieName)?.value;
  const proofValid = rawToken
    ? await validateSessionProof({
        rawToken,
        appUserId: primary.appUser.id,
        credentialId: credential.id,
        authSessionId: primary.sessionId,
        now: new Date(),
      })
    : false;

  return proofValid
    ? { kind: "AUTHENTICATED", primary, credentialId: credential.id }
    : { kind: "TOTP_REQUIRED", primary, credentialId: credential.id };
}
