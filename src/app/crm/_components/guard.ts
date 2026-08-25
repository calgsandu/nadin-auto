import { redirect } from "next/navigation";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import { canViewSection } from "@/lib/roles";
import type { WorkspaceSectionId } from "@/lib/operations/workspace";

/**
 * Poarta fiecărei secțiuni CRM: sesiune validă, 2FA trecut, rol care poate
 * vedea secțiunea. Se apelează ÎNAINTE de orice interogare a datelor —
 * `getAuthAccessState` e memoizat pe cerere, deci layout-ul și pagina împart
 * același rezultat.
 */
export async function requireCrmSection(section: WorkspaceSectionId) {
  const authState = await getAuthAccessState();
  if (authState.kind === "UNAUTHENTICATED") redirect("/auth/sign-in");
  if (authState.kind !== "AUTHENTICATED") redirect("/auth/2fa/continue");

  const appUser = authState.primary.appUser;
  if (!canViewSection(appUser.role, section)) redirect("/");

  return appUser;
}
