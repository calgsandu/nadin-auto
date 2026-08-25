import type { ReactNode } from "react";
import { getSection, type WorkspaceSectionId } from "@/lib/operations/workspace";
import type { AppRole } from "@/generated/prisma/enums";
import { SectionTabs } from "./chrome";

/** Bara de titlu a secțiunii plus sub-tab-urile grupului. */
export function CrmHeader({
  section,
  role,
  children,
}: {
  section: WorkspaceSectionId;
  role: AppRole;
  children?: ReactNode;
}) {
  return (
    <>
      <header className="motion-page border-b border-[#e8e7e3] bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-[#1b1a17]">
            {getSection(section).title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        </div>
      </header>
      <SectionTabs role={role} />
    </>
  );
}
