import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import { readTwoFactorConfig } from "@/lib/auth/two-factor/config";
import {
  consumeAndRotateTrustedDevice,
  issueSessionProof,
  twoFactorCookieOptions,
} from "@/lib/auth/two-factor/session";

export async function GET(request: NextRequest) {
  const state = await getAuthAccessState();

  switch (state.kind) {
    case "UNAUTHENTICATED":
      if (state.reason === "STALE_AFTER_RESET") await auth.signOut();
      return NextResponse.redirect(new URL("/auth/sign-in", request.url));
    case "ENROLLMENT_REQUIRED":
      return NextResponse.redirect(new URL("/auth/2fa/setup", request.url));
    case "AUTHENTICATED":
      return NextResponse.redirect(new URL("/crm", request.url));
    case "TOTP_REQUIRED": {
      const config = readTwoFactorConfig();
      const trustedToken = request.cookies.get(config.trustedCookieName)?.value ?? null;
      const rotated = trustedToken
        ? await consumeAndRotateTrustedDevice({
            rawToken: trustedToken,
            appUserId: state.primary.appUser.id,
            credentialId: state.credentialId,
            now: new Date(),
          })
        : null;
      if (!rotated) {
        const response = NextResponse.redirect(new URL("/auth/2fa/verify", request.url));
        if (trustedToken) response.cookies.delete(config.trustedCookieName);
        return response;
      }

      const proof = await issueSessionProof({
        appUserId: state.primary.appUser.id,
        credentialId: state.credentialId,
        authSessionId: state.primary.sessionId,
        sessionExpiresAt: state.primary.sessionExpiresAt,
      });
      const response = NextResponse.redirect(new URL("/crm", request.url));
      response.cookies.set(
        config.proofCookieName,
        proof.rawToken,
        twoFactorCookieOptions(proof.expiresAt),
      );
      response.cookies.set(
        config.trustedCookieName,
        rotated.rawToken,
        twoFactorCookieOptions(rotated.expiresAt),
      );
      return response;
    }
  }
}
