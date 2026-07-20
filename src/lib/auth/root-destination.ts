import type { AuthAccessState } from "./two-factor/types";

export function resolveRootDestination(kind: AuthAccessState["kind"]) {
  switch (kind) {
    case "UNAUTHENTICATED":
      return "/catalog" as const;
    case "ENROLLMENT_REQUIRED":
      return "/auth/2fa/setup" as const;
    case "TOTP_REQUIRED":
      return "/auth/2fa/verify" as const;
    case "AUTHENTICATED":
      return "/crm" as const;
  }
}
