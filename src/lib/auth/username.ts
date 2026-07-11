const USERNAME_RE = /^[a-z0-9._-]+$/;
const TECHNICAL_EMAIL_DOMAIN = "staff.nadinauto.invalid";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);

  if (username.length < 3 || username.length > 32) {
    return "Numele de utilizator trebuie să aibă între 3 și 32 de caractere.";
  }
  if (!USERNAME_RE.test(username)) {
    return "Folosește doar litere mici, cifre, punct, cratimă sau underscore.";
  }
  return null;
}

export function technicalEmailForUsername(username: string) {
  return `${normalizeUsername(username)}@${TECHNICAL_EMAIL_DOMAIN}`;
}
