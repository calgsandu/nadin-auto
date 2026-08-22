import { prisma } from "@/lib/prisma";

export function isActiveAppUser<T extends { active: boolean }>(
  user: T | null | undefined,
): user is T {
  return user?.active === true;
}

/**
 * Utilizatorul aplicației + credențialul 2FA, într-un singur dus-întors.
 * Verificarea accesului avea nevoie de amândouă și le cerea pe rând.
 */
export async function findActiveAppUser(authUserId: string) {
  const user = await prisma.appUser.findUnique({
    where: { authUserId },
    include: { twoFactorCredential: { select: { id: true, status: true } } },
  });
  return isActiveAppUser(user) ? user : null;
}
