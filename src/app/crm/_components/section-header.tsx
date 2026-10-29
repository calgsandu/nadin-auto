import type { ReactNode } from "react";
import { getSection, groupForSection, type WorkspaceSectionId } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";
import { SectionTabs } from "./chrome";

/**
 * Bara de sus a secțiunii, pe un singur rând: titlul (sau sub-tab-urile
 * grupului) și acțiunile paginii. Titlul rămâne în `h1` și când nu se vede,
 * pentru cititoarele de ecran.
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
  // Grupurile „list" au deja fiecare secțiune în sidebar-ul de desktop: acolo
  // bara arată titlul, iar tab-urile rămân doar pe telefon (unde sidebar-ul e
  // un singur rând de grupuri).
  const tabsOnDesktop = hasTabs && group?.display === "tabs";

  return (
    <header className="motion-page border-b border-[#e4e4e7] bg-white px-4 lg:px-5">
      <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 py-2">
        <h1
          className={`text-base font-semibold tracking-tight text-[#18181b] ${
            tabsOnDesktop ? "sr-only" : hasTabs ? "hidden lg:block" : ""
          }`}
        >
          {title}
        </h1>
        {hasTabs ? (
          <div className={`min-w-0 ${tabsOnDesktop ? "" : "lg:hidden"}`}>
            <SectionTabs role={role} />
          </div>
        ) : null}
        {children ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
