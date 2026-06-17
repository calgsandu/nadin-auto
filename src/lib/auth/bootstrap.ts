import type { AppRole } from "@/generated/prisma/enums";

/** Comma-separated emails that should be ADMIN on first sign-in. */
export function getAdminEmails(): string[] {
  return (process.env.NADIN_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Role assigned when an AppUser row is first created. */
export function resolveInitialRole(
  email: string | null | undefined,
  adminEmails: string[],
): AppRole {
  const normalized = email?.trim().toLowerCase();
  if (normalized && adminEmails.includes(normalized)) {
    return "ADMIN";
  }
  return "ANGAJAT";
}
