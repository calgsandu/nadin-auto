import { validateUsername } from "@/lib/auth/username";

export type AuthFormState = {
  error: string | null;
};

export const initialAuthFormState: AuthFormState = {
  error: null,
};

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email sau parolă greșite. Verifică datele introduse.",
  INVALID_PASSWORD: "Email sau parolă greșite. Verifică datele introduse.",
  INVALID_CREDENTIALS: "Email sau parolă greșite. Verifică datele introduse.",
  invalid_credentials: "Email sau parolă greșite. Verifică datele introduse.",
  USER_ALREADY_EXISTS: "Există deja un cont cu acest email. Autentifică-te sau folosește altă adresă.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Există deja un cont cu acest email. Autentifică-te sau folosește altă adresă.",
  EMAIL_EXISTS: "Există deja un cont cu acest email. Autentifică-te sau folosește altă adresă.",
  email_exists: "Există deja un cont cu acest email. Autentifică-te sau folosește altă adresă.",
  INVALID_EMAIL: "Adresa de email nu este validă.",
  email_address_invalid: "Adresa de email nu este validă.",
  EMAIL_NOT_VERIFIED: "Verifică emailul înainte de autentificare.",
  email_not_confirmed: "Verifică emailul înainte de autentificare.",
  PASSWORD_TOO_SHORT: "Parola trebuie să aibă cel puțin 8 caractere.",
  PASSWORD_TOO_LONG: "Parola introdusă este prea lungă.",
  WEAK_PASSWORD: "Parola introdusă nu este suficient de sigură.",
  weak_password: "Parola introdusă nu este suficient de sigură.",
  USER_EMAIL_NOT_FOUND: "Nu există un cont pentru această adresă de email.",
  user_not_found: "Nu există un cont pentru această adresă de email.",
  TOO_MANY_REQUESTS: "Prea multe încercări. Așteaptă puțin și încearcă din nou.",
  over_email_send_rate_limit: "Prea multe emailuri trimise. Așteaptă puțin și încearcă din nou.",
};

const GENERIC_AUTH_ERROR =
  "Nu am putut finaliza autentificarea. Verifică emailul și parola, apoi încearcă din nou.";

export function getAuthErrorMessage(
  err: { code?: string; message?: string } | null,
): string {
  if (!err) return "A apărut o eroare. Încearcă din nou.";
  if (err.code && ERRORS[err.code]) return ERRORS[err.code];
  if (!err.message) return GENERIC_AUTH_ERROR;

  const normalizedMessage = err.message.toLowerCase();
  if (
    normalizedMessage.includes("invalid email or password") ||
    normalizedMessage.includes("invalid credentials") ||
    normalizedMessage.includes("invalid password") ||
    normalizedMessage.includes("wrong password") ||
    normalizedMessage.includes("incorrect")
  ) {
    return ERRORS.INVALID_EMAIL_OR_PASSWORD;
  }
  if (
    normalizedMessage.includes("user already exists") ||
    normalizedMessage.includes("email already")
  ) {
    return ERRORS.USER_ALREADY_EXISTS;
  }
  if (
    normalizedMessage.includes("invalid email") ||
    normalizedMessage.includes("email address")
  ) {
    return ERRORS.INVALID_EMAIL;
  }
  if (
    normalizedMessage.includes("email") &&
    (normalizedMessage.includes("not verified") ||
      normalizedMessage.includes("not confirmed") ||
      normalizedMessage.includes("confirm"))
  ) {
    return ERRORS.EMAIL_NOT_VERIFIED;
  }
  if (
    normalizedMessage.includes("password") &&
    (normalizedMessage.includes("short") || normalizedMessage.includes("minimum"))
  ) {
    return ERRORS.PASSWORD_TOO_SHORT;
  }
  if (
    normalizedMessage.includes("password") &&
    (normalizedMessage.includes("weak") || normalizedMessage.includes("requirements"))
  ) {
    return ERRORS.WEAK_PASSWORD;
  }
  if (
    normalizedMessage.includes("too many") ||
    normalizedMessage.includes("rate limit")
  ) {
    return ERRORS.TOO_MANY_REQUESTS;
  }
  if (
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("connection")
  ) {
    return "Nu ne-am putut conecta la serviciul de autentificare. Verifică internetul și încearcă din nou.";
  }

  return GENERIC_AUTH_ERROR;
}

export function getUsernameValidationMessage(
  username: string,
  password: string,
): string | null {
  if (!username.trim()) return "Introdu numele de utilizator.";
  const usernameError = validateUsername(username);
  if (usernameError) return usernameError;
  if (!password) return "Introdu parola.";
  if (password.length < 8) return "Parola introdusă este prea scurtă.";
  return null;
}

export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (!currentPassword) return "Introdu parola actuală.";
  if (newPassword.length < 8) {
    return "Parola nouă trebuie să aibă cel puțin 8 caractere.";
  }
  if (newPassword.length > 128) {
    return "Parola nouă poate avea cel mult 128 de caractere.";
  }
  if (newPassword !== confirmPassword) return "Parolele noi nu coincid.";
  return null;
}

export function getDefaultDisplayName(email: string, name: string): string {
  const trimmedName = name.trim();
  if (trimmedName) return trimmedName;
  return email.split("@")[0] || email;
}
