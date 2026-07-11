"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/auth/username";
import { performLogout } from "@/app/auth/logout";
import {
  getUsernameValidationMessage,
  type AuthFormState,
} from "@/app/auth/form-state";

const INVALID_CREDENTIALS = "Nume de utilizator sau parolă greșite.";

export async function authenticateWithUsername(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const validationError = getUsernameValidationMessage(username, password);

  if (validationError) {
    return { error: validationError };
  }

  try {
    const appUser = await prisma.appUser.findUnique({ where: { username } });
    if (!appUser?.active || !appUser.email) {
      return { error: INVALID_CREDENTIALS };
    }
    const result = await auth.signIn.email({
      email: appUser.email,
      password,
      callbackURL: "/",
    });

    if (result?.error) {
      return { error: INVALID_CREDENTIALS };
    }
  } catch {
    return { error: INVALID_CREDENTIALS };
  }

  redirect("/");
}

export async function logoutAction() {
  await performLogout({
    signOut: () => auth.signOut(),
    redirect,
  });
}
