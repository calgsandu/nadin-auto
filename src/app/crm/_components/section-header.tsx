import type { ReactNode } from "react";
import { groupForSection, sectionLabel, type WorkspaceSectionId } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";
import { HeaderNotifications, SectionTabs } from "./chrome";

/**
 * Antetul secțiunii: titlul mare, acțiunile paginii și clopoțelul „De făcut".
 * Sub-tab-urile grupului apar doar unde meniul nu le arată deja.
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
  // Același nume ca în meniu: „Proforme" nu devine „Conturi de plată" pe pagină.
  const title = sectionLabel(section);
  const group = groupForSection(section);
  const hasTabs =
    (group?.sections.filter((id) => canViewSection(role, id)).length ?? 0) > 1;
  const tabsOnDesktop = hasTabs && group?.display === "tabs";

  return (
    <header className="motion-page px-4 pt-1 lg:px-6 lg:pt-4">
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 py-2">
        <h1 className="text-[1.375rem] font-semibold tracking-tight text-[#0f172a] lg:text-[1.625rem]">{title}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {children}
          <HeaderNotifications />
        </div>
      </div>
      {/* Pe desktop secțiunile grupului sunt în meniu, sub grup; tab-urile
          rămân pentru telefon și pentru meniul restrâns (vezi globals.css). */}
      {hasTabs ? (
        <div className={`border-b border-[#e5e9f0] ${tabsOnDesktop ? "crm-header-tabs" : "lg:hidden"}`}>
          <SectionTabs role={role} />
        </div>
      ) : null}
    </header>
  );
}
