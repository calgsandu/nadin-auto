import { cache } from "react";
import { cookies } from "next/headers";
import type { TwoFactorCredentialStatus } from "@/generated/prisma/enums";
import { readTwoFactorConfig } from "./config";
import { readPrimaryAuthResult } from "./primary";
import { findSessionProofByToken, sessionProofMatches } from "./session";
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

/**
 * Starea de acces, o singură dată per cerere.
 *
 * Înainte erau patru dus-întorsuri în serie (sesiune → AppUser → credențial →
 * dovadă). Credențialul vine acum în interogarea utilizatorului, iar dovada de
 * sesiune se caută în paralel după `tokenHash` (unic) și se validează în
 * memorie cu `sessionProofMatches` — aceleași verificări, două dus-întorsuri.
 */
export const getAuthAccessState = cache(async (): Promise<AuthAccessState> => {
  const config = readTwoFactorConfig();
  const rawToken = (await cookies()).get(config.proofCookieName)?.value;

  const [primaryResult, storedProof] = await Promise.all([
    readPrimaryAuthResult(),
    rawToken ? findSessionProofByToken(rawToken) : Promise.resolve(null),
  ]);

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

  const credential = primary.appUser.twoFactorCredential;
  if (!credential || credential.status === "PENDING") {
    return {
      kind: "ENROLLMENT_REQUIRED",
      primary,
      pendingCredentialId: credential?.id ?? null,
    };
  }

  const proofValid =
    rawToken != null
    && storedProof != null
    && sessionProofMatches(storedProof, {
      rawToken,
      appUserId: primary.appUser.id,
      credentialId: credential.id,
      authSessionId: primary.sessionId,
      now: new Date(),
    });

  return proofValid
    ? { kind: "AUTHENTICATED", primary, credentialId: credential.id }
    : { kind: "TOTP_REQUIRED", primary, credentialId: credential.id };
});
