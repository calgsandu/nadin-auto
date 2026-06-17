"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { performLogout } from "@/app/auth/logout";
import {
  getCredentialValidationMessage,
  getAuthErrorMessage,
  getDefaultDisplayName,
  type AuthFormState,
  type AuthMode,
} from "@/app/auth/form-state";

export async function authenticateWithEmail(
  mode: AuthMode,
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");
  const validationError = getCredentialValidationMessage(mode, email, password);

  if (validationError) {
    return { error: validationError };
  }

  try {
    const result =
      mode === "sign-up"
        ? await auth.signUp.email({
            email,
            password,
            name: getDefaultDisplayName(email, name),
            callbackURL: "/",
          })
        : await auth.signIn.email({
            email,
            password,
            callbackURL: "/",
          });

    if (result?.error) {
      return { error: getAuthErrorMessage(result.error) };
    }
  } catch (error) {
    return {
      error: getAuthErrorMessage(
        error instanceof Error ? { message: error.message } : null,
      ),
    };
  }

  redirect("/");
}

export async function logoutAction() {
  await performLogout({
    signOut: () => auth.signOut(),
    redirect,
  });
}
