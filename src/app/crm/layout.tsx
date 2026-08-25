import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import { getPendingApprovalCount } from "@/lib/audit/queries";
import { canReviewOperations } from "@/lib/roles";
import { CrmChrome, Sidebar } from "./_components/chrome";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Shell-ul CRM-ului: nav + contorul de aprobări. Layout-ul supraviețuiește
 * navigării între secțiuni, deci ambele se încarcă o singură dată per sesiune
 * de navigare, nu la fiecare schimbare de tab.
 */
export default async function CrmLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const authState = await getAuthAccessState();
  if (authState.kind === "UNAUTHENTICATED") redirect("/auth/sign-in");
  if (authState.kind !== "AUTHENTICATED") redirect("/auth/2fa/continue");

  const appUser = authState.primary.appUser;
  const pendingApprovals = canReviewOperations(appUser.role)
    ? await getPendingApprovalCount()
    : 0;

  return (
    <CrmChrome pendingApprovals={pendingApprovals}>
      <main className="crm-main min-h-[100dvh] bg-[#f6f6f4] lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="crm-aside sticky top-0 z-40 border-b border-[#e8e7e3] bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-[13.5rem] lg:border-b-0 lg:border-r">
          <Sidebar
            role={appUser.role}
            userName={appUser.name}
            userEmail={appUser.email}
          />
        </aside>

        <section className="min-w-0 lg:col-start-2">{children}</section>
      </main>
    </CrmChrome>
  );
}
