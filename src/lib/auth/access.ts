import { auth } from "@/lib/auth/server";
import { ensureAppUser } from "@/lib/users";
import type { AppRole } from "@/generated/prisma/enums";

export type CurrentAppUser = {
  id: string;
  role: AppRole;
  name: string | null;
  email: string | null;
  mode: "authenticated";
};

export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return null;
  }

  const appUser = await ensureAppUser({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });

  return {
    id: appUser.id,
    role: appUser.role,
    name: appUser.name,
    email: appUser.email,
    mode: "authenticated",
  };
}

export async function requireCurrentAppUser() {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    throw new Error("Trebuie să fii autentificat.");
  }

  return appUser;
}
