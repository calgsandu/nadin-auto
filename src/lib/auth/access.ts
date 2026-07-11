import { auth } from "@/lib/auth/server";
import { findActiveAppUser } from "@/lib/users";
import type { AppRole } from "@/generated/prisma/enums";

export type CurrentAppUser = {
  id: string;
  role: AppRole;
  name: string | null;
  email: string | null;
  username: string | null;
  active: true;
  mode: "authenticated";
};

export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    return null;
  }

  const appUser = await findActiveAppUser(session.user.id);
  if (!appUser) return null;

  return {
    id: appUser.id,
    role: appUser.role,
    name: appUser.name,
    email: appUser.email,
    username: appUser.username,
    active: true,
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
