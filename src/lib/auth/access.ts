import type { AppRole } from "@/generated/prisma/enums";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";

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
  const state = await getAuthAccessState();
  if (state.kind !== "AUTHENTICATED") return null;
  const appUser = state.primary.appUser;

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
    throw new Error("Trebuie să finalizezi autentificarea în doi pași.");
  }

  return appUser;
}
