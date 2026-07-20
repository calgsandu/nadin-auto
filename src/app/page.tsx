import { redirect } from "next/navigation";
import { resolveRootDestination } from "@/lib/auth/root-destination";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const state = await getAuthAccessState();
  redirect(resolveRootDestination(state.kind));
}
