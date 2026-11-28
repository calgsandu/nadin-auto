import type { ReactNode } from "react";
import { groupForSection, sectionLabel, type WorkspaceSectionId } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";
import { SectionTabs } from "./chrome";

/**
 * Antetul secțiunii: titlul mare, un rând cu cifrele care contează pe pagina
 * asta (`summary`), secțiunile grupului ca pastile și acțiunile paginii.
 * Grupurile zilnice au deja câte o pastilă pe secțiune în bara de sus, deci
 * pe desktop nu-și mai repetă secțiunile aici.
 */
export function CrmHeader({
  section,
  role,
  summary,
  children,
}: {
  section: WorkspaceSectionId;
  role: AppRole;
  /** Un singur rând, din cifre reale: „3 proforme neachitate, 12 400 lei". */
  summary?: ReactNode;
  children?: ReactNode;
}) {
  // Același nume ca în meniu: „Proforme" nu devine „Conturi de plată" pe pagină.
  const title = sectionLabel(section);
  const group = groupForSection(section);
  const hasTabs =
    (group?.sections.filter((id) => canViewSection(role, id)).length ?? 0) > 1;
  const tabsOnDesktop = hasTabs && group?.display === "tabs";

  return (
    <header className="motion-page px-4 pt-2 lg:px-6 lg:pt-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-1">
        <div className="mr-auto min-w-0">
          <h1 className="text-[1.375rem] font-medium leading-tight tracking-tight text-(--c-ink) lg:text-[1.625rem]">
            {title}
          </h1>
          {summary ? <p className="mt-1 text-sm text-(--c-muted)">{summary}</p> : null}
        </div>
        {hasTabs ? (
          <div className={`max-lg:order-last max-lg:w-full ${tabsOnDesktop ? "" : "lg:hidden"}`}>
            <SectionTabs role={role} />
          </div>
        ) : null}
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}
