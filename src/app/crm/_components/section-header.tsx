import type { ReactNode } from "react";
import { getSection, groupForSection, type WorkspaceSectionId } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";
import { SectionTabs } from "./chrome";

/**
 * Bara de sus a secțiunii, pe un singur rând: sub-tab-urile grupului (sau
 * titlul, când grupul are o singură secțiune) și acțiunile paginii.
 * Titlul rămâne în `h1` pentru cititoarele de ecran și tab-ul browserului.
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
  const hasTabs =
    (groupForSection(section)?.sections.filter((id) => canViewSection(role, id)).length ?? 0) > 1;

  return (
    <header className="motion-page border-b border-[#e8e7e3] bg-white px-4 lg:px-5">
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 py-2">
        {hasTabs ? (
          <>
            <h1 className="sr-only">{title}</h1>
            <SectionTabs role={role} />
          </>
        ) : (
          <h1 className="text-base font-semibold tracking-tight text-[#1b1a17]">{title}</h1>
        )}
        {children ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
