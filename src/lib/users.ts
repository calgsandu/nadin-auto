import { prisma } from "@/lib/prisma";
import { getAdminEmails, resolveInitialRole } from "@/lib/auth/bootstrap";
import type { AppRole } from "@/generated/prisma/enums";

type AuthSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export { getAdminEmails, resolveInitialRole };

export async function ensureAppUser(user: AuthSessionUser) {
  return prisma.appUser.upsert({
    where: { authUserId: user.id },
    create: {
      authUserId: user.id,
      email: user.email,
      name: user.name,
      // Bootstrap: configured admin emails become ADMIN; everyone else ANGAJAT.
      // On update we never touch role, so manual role changes are preserved.
      role: resolveInitialRole(user.email, getAdminEmails()),
    },
    update: {
      email: user.email,
      name: user.name,
    },
  });
}

export type AppUserWithRole = Awaited<ReturnType<typeof ensureAppUser>> & {
  role: AppRole;
};
