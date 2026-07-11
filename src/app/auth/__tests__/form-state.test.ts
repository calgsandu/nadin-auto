import assert from "node:assert/strict";
import {
  getDefaultDisplayName,
  getAuthErrorMessage,
  getUsernameValidationMessage,
  getSocialRedirectUrl,
  initialAuthFormState,
  validatePasswordChange,
} from "@/app/auth/form-state";

assert.deepEqual(initialAuthFormState, { error: null });

assert.equal(getDefaultDisplayName("ion@example.com", ""), "ion");
assert.equal(getDefaultDisplayName("ion@example.com", " Ion Popescu "), "Ion Popescu");

assert.equal(
  getAuthErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }),
  "Email sau parolă greșite. Verifică datele introduse.",
);
assert.equal(
  getAuthErrorMessage({ code: "USER_ALREADY_EXISTS" }),
  "Există deja un cont cu acest email. Autentifică-te sau folosește altă adresă.",
);
assert.equal(
  getAuthErrorMessage({ code: "INVALID_EMAIL" }),
  "Adresa de email nu este validă.",
);
assert.equal(
  getAuthErrorMessage({ code: "EMAIL_NOT_VERIFIED" }),
  "Verifică emailul înainte de autentificare.",
);
assert.equal(
  getAuthErrorMessage({ message: "Invalid email or password" }),
  "Email sau parolă greșite. Verifică datele introduse.",
);
assert.equal(
  getAuthErrorMessage({ message: "Custom auth error" }),
  "Nu am putut finaliza autentificarea. Verifică emailul și parola, apoi încearcă din nou.",
);
assert.equal(getAuthErrorMessage(null), "A apărut o eroare. Încearcă din nou.");

assert.equal(getUsernameValidationMessage("", "parola123"), "Introdu numele de utilizator.");
assert.equal(
  getUsernameValidationMessage("ion popescu", "parola123"),
  "Folosește doar litere mici, cifre, punct, cratimă sau underscore.",
);
assert.equal(getUsernameValidationMessage("ion", ""), "Introdu parola.");
assert.equal(
  getUsernameValidationMessage("ion", "123"),
  "Parola introdusă este prea scurtă.",
);
assert.equal(getUsernameValidationMessage("Ion_2", "parola123"), null);

assert.equal(
  validatePasswordChange("", "parolaNoua", "parolaNoua"),
  "Introdu parola actuală.",
);
assert.equal(
  validatePasswordChange("parola123", "scurta", "scurta"),
  "Parola nouă trebuie să aibă cel puțin 8 caractere.",
);
assert.equal(
  validatePasswordChange("parola123", "parolaNoua", "altaParola"),
  "Parolele noi nu coincid.",
);
assert.equal(
  validatePasswordChange("parola123", "parolaNoua", "parolaNoua"),
  null,
);

assert.equal(
  getSocialRedirectUrl({ data: { url: "https://accounts.google.com/o/oauth2/v2/auth" } }),
  "https://accounts.google.com/o/oauth2/v2/auth",
);
assert.equal(getSocialRedirectUrl({ data: { redirect: true } }), null);

console.log("auth form-state tests passed");
