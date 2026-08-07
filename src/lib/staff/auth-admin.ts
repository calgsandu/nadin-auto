import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

/**
 * Serviciul de autentificare are propriul rol („admin"/„user"), separat de
 * AppRole. Dacă contul care administrează personalul nu e „admin" ACOLO,
 * endpointurile de administrare răspund în engleză — traducem și spunem ce e de făcut.
 */
const AUTH_ERROR_HINTS: { match: RegExp; message: string }[] = [
  {
    match: /not allowed to (create|list|ban|delete|remove|update|set)/i,
    message:
      "Contul tău nu are rol de administrator în serviciul de autentificare (Neon Auth), deși în aplicație ești ADMIN. Un administrator trebuie să-ți pună rolul „admin” în Neon Auth (tabelul neon_auth.user, coloana role).",
  },
  {
    match: /user already exists|email.*exists/i,
    message: "Există deja un cont cu acest nume de utilizator.",
  },
];

function assertResult<T extends { error?: { message?: string } | null }>(
  result: T,
  fallback: string,
) {
  if (result.error) {
    const raw = result.error.message ?? "";
    const hint = AUTH_ERROR_HINTS.find((entry) => entry.match.test(raw));
    throw new Error(hint?.message || raw || fallback);
  }
  return result;
}

export async function createAuthIdentity(input: {
  email: string;
  password: string;
  name: string;
  authRole?: "admin" | "user";
}) {
  const { authRole = "user", ...credentials } = input;
  const result = assertResult(
    await auth.admin.createUser({ ...credentials, role: authRole }),
    "Identitatea nu a putut fi creată.",
  );
  const userId = result.data?.user.id;
  if (!userId) throw new Error("Serviciul de autentificare nu a returnat utilizatorul.");
  return String(userId);
}

export async function setAuthRole(
  userId: string,
  role: "admin" | "user",
) {
  assertResult(
    await auth.admin.setRole({ userId, role }),
    "Rolul din serviciul de autentificare nu a putut fi actualizat.",
  );
}

export async function setAuthPassword(userId: string, newPassword: string) {
  assertResult(
    await auth.admin.setUserPassword({ userId, newPassword }),
    "Parola nu a putut fi resetată.",
  );
}

/**
 * ATENȚIE: citește neon_auth prin conexiunea aplicației. Dacă DATABASE_URL e pe
 * alt branch Neon decât cel pe care scrie serviciul de autentificare, datele de
 * aici sunt o copie veche, înghețată la momentul forkului.
 */
export async function getAuthProviderIds(userId: string) {
  const accounts = await prisma.$queryRaw<Array<{ providerId: string }>>`
    SELECT "providerId"
    FROM neon_auth.account
    WHERE "userId"::text = ${userId}
  `;
  return accounts.map((account) => account.providerId);
}

export async function banAuthIdentity(userId: string) {
  assertResult(
    await auth.admin.banUser({
      userId,
      banReason: "Cont dezactivat de administrator",
    }),
    "Contul nu a putut fi blocat în serviciul de autentificare.",
  );
}

export async function unbanAuthIdentity(userId: string) {
  assertResult(
    await auth.admin.unbanUser({ userId }),
    "Contul nu a putut fi reactivat în serviciul de autentificare.",
  );
}

export async function revokeAuthSessions(userId: string) {
  assertResult(
    await auth.admin.revokeUserSessions({ userId }),
    "Sesiunile nu au putut fi revocate.",
  );
}

export async function removeAuthIdentity(userId: string) {
  assertResult(
    await auth.admin.removeUser({ userId }),
    "Identitatea incompletă nu a putut fi eliminată.",
  );
}
