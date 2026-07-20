import type { AppUser } from "@/generated/prisma/client";

export type PrimaryAuthContext = {
  sessionId: string;
  sessionCreatedAt: Date;
  sessionExpiresAt: Date;
  authUserId: string;
  appUser: AppUser;
};

export type AuthAccessState =
  | {
      kind: "UNAUTHENTICATED";
      reason: "NO_SESSION" | "NO_ACTIVE_APP_USER" | "STALE_AFTER_RESET";
    }
  | {
      kind: "ENROLLMENT_REQUIRED";
      primary: PrimaryAuthContext;
      pendingCredentialId: string | null;
    }
  | {
      kind: "TOTP_REQUIRED";
      primary: PrimaryAuthContext;
      credentialId: string;
    }
  | {
      kind: "AUTHENTICATED";
      primary: PrimaryAuthContext;
      credentialId: string;
    };
