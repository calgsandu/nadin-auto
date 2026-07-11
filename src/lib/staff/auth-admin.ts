import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

function assertResult<T extends { error?: { message?: string } | null }>(
  result: T,
  fallback: string,
) {
  if (result.error) throw new Error(result.error.message || fallback);
  return result;
}

export async function createAuthIdentity(input: {
  email: string;
  password: string;
  name: string;
}) {
  const result = assertResult(
    await auth.admin.createUser({ ...input, role: "user" }),
    "Identitatea nu a putut fi creată.",
  );
  const userId = result.data?.user.id;
  if (!userId) throw new Error("Serviciul de autentificare nu a returnat utilizatorul.");
  return String(userId);
}

export async function setAuthPassword(userId: string, newPassword: string) {
  assertResult(
    await auth.admin.setUserPassword({ userId, newPassword }),
    "Parola nu a putut fi resetată.",
  );
}

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
