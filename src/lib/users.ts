import { prisma } from "@/lib/prisma";

export function isActiveAppUser<T extends { active: boolean }>(
  user: T | null | undefined,
): user is T {
  return user?.active === true;
}

export async function findActiveAppUser(authUserId: string) {
  const user = await prisma.appUser.findUnique({ where: { authUserId } });
  return isActiveAppUser(user) ? user : null;
}
