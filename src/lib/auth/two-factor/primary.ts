import { cache } from "react";
import { auth } from "@/lib/auth/server";
import { findActiveAppUser } from "@/lib/users";
import type { PrimaryAuthContext } from "./types";

export type PrimaryAuthResult =
  | { primary: PrimaryAuthContext; reason: null }
  | { primary: null; reason: "NO_SESSION" | "NO_ACTIVE_APP_USER" };

/** `cache` = o singură verificare de sesiune per cerere, oricâți o cer. */
export const readPrimaryAuthResult = cache(async (): Promise<PrimaryAuthResult> => {
  const { data, error } = await auth.getSession();
  if (error) {
    // Cauza era aruncată la gunoi, deci un esec de sesiune (Neon Auth pornit
    // la rece, retea cazuta) ajungea pe ecran ca o eroare fara explicatie si
    // fara nimic in loguri. Acum ramane atasata: `cause` pentru stiva,
    // `console.error` pentru logurile serverului.
    console.error("[auth] getSession a esuat", error);
    throw new Error("Nu am putut verifica sesiunea de autentificare.", { cause: error });
  }
  if (!data?.user || !data.session) {
    return { primary: null, reason: "NO_SESSION" };
  }

  const appUser = await findActiveAppUser(data.user.id);
  if (!appUser) {
    return { primary: null, reason: "NO_ACTIVE_APP_USER" };
  }

  return {
    primary: {
      sessionId: data.session.id,
      sessionCreatedAt: new Date(data.session.createdAt),
      sessionExpiresAt: new Date(data.session.expiresAt),
      authUserId: data.user.id,
      appUser,
    },
    reason: null,
  };
});

export async function getPrimaryAuthContext() {
  const result = await readPrimaryAuthResult();
  return result.primary;
}
