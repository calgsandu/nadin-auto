import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import { getPendingApprovalCount } from "@/lib/audit/queries";
import { prisma } from "@/lib/prisma";
import { getReorderList } from "@/lib/operations/reorder";
import { canReviewOperations, canViewSection, canWriteCatalog } from "@/lib/roles";
import { StickerTray } from "@/app/catalog/sticker-tray";
import { CrmChrome, TopBar } from "./_components/chrome";

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
  const [aprobari, deAdus, proforme, deComandat] = await Promise.all([
    canReviewOperations(role) ? getPendingApprovalCount() : 0,
    canViewSection(role, "de-adus")
      ? prisma.restockTask.count({ where: { status: "PENDING", warehouse: { name: "Pavilion 110A" } } })
      : 0,
    canViewSection(role, "conturi-plata")
      ? prisma.paymentAccount.count({ where: { status: "ISSUED", paidAt: null } })
      : 0,
    // Piesele vândute care se termină — doar pentru cine comandă marfă.
    canWriteCatalog(role) && canViewSection(role, "de-comandat")
      ? getReorderList().then((groups) => groups.reduce((sum, group) => sum + group.items.length, 0))
      : 0,
  ]);

  // Tema aleasă din bara de sus; implicit deschisă.
  const theme = (await cookies()).get("nadin-theme")?.value === "dark" ? "dark" : "light";

  return (
    <CrmChrome counts={{ aprobari, "de-adus": deAdus, "conturi-plata": proforme, "de-comandat": deComandat }}>
      <main data-theme={theme} className="crm-main min-h-[100dvh] bg-(--c-bg)">
        {/* Bara de sus stă pe același fundal ca pagina; fără blur: un
            `backdrop-filter` ar prinde drawerele `fixed` din ea. */}
        <header className="sticky top-0 z-40 border-b border-(--c-line) bg-(--c-bg) lg:border-b-0">
          <div>
            <TopBar role={appUser.role} userName={appUser.name} userEmail={appUser.email} />
          </div>
        </header>
        <section className="min-w-0 pb-8">
          {children}
          {/* Lista de stickere e a întregului CRM: se umple din orice pagină. */}
          <StickerTray />
        </section>
      </main>
    </CrmChrome>
  );
}
