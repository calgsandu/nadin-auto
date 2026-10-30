import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import { getPendingApprovalCount } from "@/lib/audit/queries";
import { prisma } from "@/lib/prisma";
import { lowStockWhere } from "@/lib/catalog/queries";
import { canReviewOperations, canViewSection, canWriteCatalog } from "@/lib/roles";
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
  const role = appUser.role;
  // Contoarele din meniu și din clopoțel: doar ce poate deschide rolul.
  const [aprobari, deAdus, proforme, stocMic] = await Promise.all([
    canReviewOperations(role) ? getPendingApprovalCount() : 0,
    canViewSection(role, "de-adus")
      ? prisma.restockTask.count({ where: { status: "PENDING", warehouse: { name: "Pavilion 110A" } } })
      : 0,
    canViewSection(role, "conturi-plata")
      ? prisma.paymentAccount.count({ where: { status: "ISSUED", paidAt: null } })
      : 0,
    // Piesele aproape terminate — doar pentru cine comandă marfă.
    canWriteCatalog(role) ? prisma.product.count({ where: lowStockWhere }) : 0,
  ]);

  return (
    <CrmChrome counts={{ aprobari, "de-adus": deAdus, "conturi-plata": proforme, "stoc-mic": stocMic }}>
      <main className="crm-main min-h-[100dvh] bg-[#f4f4f5] lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="crm-aside sticky top-0 z-40 border-b border-[#e4e4e7] bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-[14rem] lg:border-b-0 lg:bg-transparent">
          <Sidebar
            role={appUser.role}
            userName={appUser.name}
            userEmail={appUser.email}
          />
        </aside>

        {/* Pe desktop conținutul stă într-un panou alb, pe fundalul gri al meniului. */}
        <section className="min-w-0 bg-white lg:col-start-2 lg:my-2 lg:mr-2 lg:min-h-[calc(100dvh-1rem)] lg:rounded-2xl lg:border lg:border-[#e4e4e7] lg:shadow-[0_1px_3px_rgb(24_24_27/0.05)]">
          {children}
        </section>
      </main>
    </CrmChrome>
  );
}
