import type { AppRole } from "@/generated/prisma/enums";
import { normalizeUsername, validateUsername } from "@/lib/auth/username";

const VALID_ROLES: readonly AppRole[] = ["ADMIN", "DIRECTOR", "ANGAJAT"];

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parsePassword(value: string) {
  if (value.length < 8) {
    throw new Error("Parola trebuie să aibă cel puțin 8 caractere.");
  }
  if (value.length > 128) {
    throw new Error("Parola poate avea cel mult 128 de caractere.");
  }
  return value;
}

export function parseCreateStaffInput(formData: FormData) {
  const name = readString(formData, "name");
  const username = normalizeUsername(readString(formData, "username"));
  const role = readString(formData, "role") as AppRole;
  const passwordValue = formData.get("password");
  const password = parsePassword(
    typeof passwordValue === "string" ? passwordValue : "",
  );

  if (name.length < 2 || name.length > 80) {
    throw new Error("Numele persoanei trebuie să aibă între 2 și 80 de caractere.");
  }
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);
  if (!VALID_ROLES.includes(role)) throw new Error("Rol invalid.");

  return { name, username, role, password };
}

export function parseUserId(formData: FormData) {
  const userId = readString(formData, "userId");
  if (!userId) throw new Error("Lipsește utilizatorul.");
  return userId;
}

export function needsPasswordMigration(providerIds: string[]) {
  return !providerIds.includes("credential");
}
