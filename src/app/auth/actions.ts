"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { normalizeUsername } from "@/lib/auth/username";
import { performLogout } from "@/app/auth/logout";
import { readTwoFactorConfig } from "@/lib/auth/two-factor/config";
import { hashToken } from "@/lib/auth/two-factor/crypto";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
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
      callbackURL: "/auth/2fa/continue",
    });

    if (result?.error) {
      return { error: INVALID_CREDENTIALS };
    }
  } catch {
    return { error: INVALID_CREDENTIALS };
  }

  redirect("/auth/2fa/continue");
}

export async function logoutAction() {
  await performLogout({
    clearSecondFactor: async () => {
      const config = readTwoFactorConfig();
      const cookieStore = await cookies();
      try {
        const rawToken = cookieStore.get(config.proofCookieName)?.value;
        if (rawToken) {
          await prisma.twoFactorSessionProof.deleteMany({
            where: { tokenHash: hashToken(rawToken) },
          });
        }
      } finally {
        cookieStore.delete(config.proofCookieName);
      }
    },
    reportCleanupError: (error) => {
      console.error("[2fa] logout cleanup failed", error);
    },
    signOut: () => auth.signOut(),
    redirect,
  });
}

export async function forgetCurrentTrustedDeviceAction(): Promise<void> {
  const state = await getAuthAccessState();
  if (state.kind !== "AUTHENTICATED") {
    throw new Error("Trebuie să finalizezi autentificarea în doi pași.");
  }

  const config = readTwoFactorConfig();
  const cookieStore = await cookies();
  try {
    const rawToken = cookieStore.get(config.trustedCookieName)?.value;
    if (rawToken) {
      await prisma.trustedDevice.deleteMany({
        where: {
          appUserId: state.primary.appUser.id,
          tokenHash: hashToken(rawToken),
        },
      });
    }
  } finally {
    cookieStore.delete(config.trustedCookieName);
  }
}
