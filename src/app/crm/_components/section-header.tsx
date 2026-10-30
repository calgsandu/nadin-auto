import type { ReactNode } from "react";
import { getSection, groupForSection, type WorkspaceSectionId } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";
import { HeaderNotifications, SectionTabs } from "./chrome";

/**
 * Antetul secțiunii: titlul mare, acțiunile paginii și clopoțelul „De făcut"
 * pe primul rând; dedesubt, sub-tab-urile grupului (subliniate). Grupurile
 * „list" au deja fiecare secțiune în sidebar-ul de desktop, deci acolo
 * tab-urile apar doar pe telefon.
 */
export function CrmHeader({
  section,
  role,
  children,
}: {
  section: WorkspaceSectionId;
  role: AppRole;
  children?: ReactNode;
}) {
  const title = getSection(section).title;
  const group = groupForSection(section);
  const hasTabs =
    (group?.sections.filter((id) => canViewSection(role, id)).length ?? 0) > 1;
  const tabsOnDesktop = hasTabs && group?.display === "tabs";

  return (
    <header className="motion-page border-b border-[#e4e4e7] px-4 lg:px-6">
      <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <h1 className="text-xl font-semibold tracking-tight text-[#18181b]">{title}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {children}
          <HeaderNotifications />
        </div>
      </div>
      {hasTabs ? (
        <div className={tabsOnDesktop ? "" : "lg:hidden"}>
          <SectionTabs role={role} />
        </div>
      ) : null}
    </header>
  );
}
