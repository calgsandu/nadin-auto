"use server";

import { auth } from "@/lib/auth/server";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { clearTrustedDevices } from "@/lib/auth/two-factor/reset";
import { prisma } from "@/lib/prisma";
import { validatePasswordChange } from "@/app/auth/form-state";

export type PasswordChangeState = { ok: boolean; message: string };

export async function changeOwnPasswordAction(
  _state: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  try {
    const current = await requireCurrentAppUser();
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const validationError = validatePasswordChange(
      currentPassword,
      newPassword,
      confirmPassword,
    );
    if (validationError) return { ok: false, message: validationError };

    await prisma.$transaction((tx) => clearTrustedDevices(tx, current.id));
    const result = await auth.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (result.error) {
      return { ok: false, message: "Parola actuală nu este corectă." };
    }
    return { ok: true, message: "Parola a fost schimbată." };
  } catch {
    return { ok: false, message: "Parola nu a putut fi schimbată." };
  }
}
