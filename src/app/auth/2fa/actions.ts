"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  confirmPendingEnrollment,
  InvalidTotpCodeError,
  regeneratePendingEnrollment,
} from "@/lib/auth/two-factor/enrollment";
import { readTwoFactorConfig } from "@/lib/auth/two-factor/config";
import { getPrimaryAuthContext } from "@/lib/auth/two-factor/primary";
import { trustedClientIp, TwoFactorLockedError } from "@/lib/auth/two-factor/rate-limit";
import { twoFactorCookieOptions } from "@/lib/auth/two-factor/session";

export type TwoFactorFormState = { ok: boolean; message: string };

export const initialTwoFactorFormState: TwoFactorFormState = {
  ok: false,
  message: "",
};

function safeTwoFactorError(error: unknown): TwoFactorFormState {
  if (error instanceof InvalidTotpCodeError || error instanceof TwoFactorLockedError) {
    return { ok: false, message: error.message };
  }
  console.error("[2fa] verificarea înrolării a eșuat", error);
  return { ok: false, message: "Verificarea nu a putut fi finalizată. Încearcă din nou." };
}

export async function confirmTwoFactorEnrollmentAction(
  _previous: TwoFactorFormState,
  formData: FormData,
): Promise<TwoFactorFormState> {
  const primary = await getPrimaryAuthContext();
  if (!primary) return { ok: false, message: "Sesiunea a expirat. Autentifică-te din nou." };

  const credentialId = String(formData.get("credentialId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!credentialId || !/^\d{6}$/.test(code)) {
    return { ok: false, message: "Introdu codul de 6 cifre din Authenticator." };
  }

  let result: Awaited<ReturnType<typeof confirmPendingEnrollment>>;
  try {
    result = await confirmPendingEnrollment({
      primary,
      credentialId,
      code,
      rememberDevice: formData.get("rememberDevice") === "on",
      ip: trustedClientIp(await headers()),
    });
  } catch (error) {
    return safeTwoFactorError(error);
  }

  const config = readTwoFactorConfig();
  const cookieStore = await cookies();
  cookieStore.set(
    config.proofCookieName,
    result.proofToken,
    twoFactorCookieOptions(result.proofExpiresAt),
  );
  if (result.trustedToken && result.trustedExpiresAt) {
    cookieStore.set(
      config.trustedCookieName,
      result.trustedToken,
      twoFactorCookieOptions(result.trustedExpiresAt),
    );
  }
  redirect("/crm");
}

export async function regenerateTwoFactorEnrollmentAction() {
  const primary = await getPrimaryAuthContext();
  if (!primary) redirect("/auth/sign-in");
  await regeneratePendingEnrollment(primary);
  redirect("/auth/2fa/setup");
}
