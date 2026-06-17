import assert from "node:assert/strict";
import {
  getDefaultDisplayName,
  getAuthErrorMessage,
  getCredentialValidationMessage,
  getSocialRedirectUrl,
  initialAuthFormState,
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

assert.equal(
  getCredentialValidationMessage("sign-in", "", "parola123"),
  "Introdu adresa de email.",
);
assert.equal(
  getCredentialValidationMessage("sign-in", "invalid", "parola123"),
  "Adresa de email nu este validă. Exemplu: nume@gmail.com.",
);
assert.equal(
  getCredentialValidationMessage("sign-in", "ion@gmail.com", ""),
  "Introdu parola.",
);
assert.equal(
  getCredentialValidationMessage("sign-in", "ion@gmail.com", "123"),
  "Parola introdusă este prea scurtă.",
);
assert.equal(
  getCredentialValidationMessage("sign-up", "ion@gmail.com", "123"),
  "Parola trebuie să aibă cel puțin 8 caractere.",
);
assert.equal(
  getCredentialValidationMessage("sign-in", "ion@gmail.com", "parola123"),
  null,
);

assert.equal(
  getSocialRedirectUrl({ data: { url: "https://accounts.google.com/o/oauth2/v2/auth" } }),
  "https://accounts.google.com/o/oauth2/v2/auth",
);
assert.equal(getSocialRedirectUrl({ data: { redirect: true } }), null);
assert.equal(getSocialRedirectUrl(null), null);

console.log("auth form-state tests passed");
