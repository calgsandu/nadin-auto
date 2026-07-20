import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/access";
import { resolveRootDestination } from "@/lib/auth/root-destination";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  redirect(resolveRootDestination(await getCurrentAppUser()));
}
