"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import {
  ArrowRightLeft,
  BarChart3,
  Handshake,
  Layers,
  LogOut,
  PackageSearch,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { ChangePasswordDialog } from "@/app/account/change-password-dialog";
import { TrustedDeviceControl } from "@/app/account/trusted-device-control";
import { SidebarCollapseButton } from "../sidebar-collapse";
import { crmSectionHref, sectionFromPathname } from "@/lib/crm/urls";
import { groupForSection, navigationGroups, sectionLabel } from "@/lib/operations/workspace";
import { canManageStaff, canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";

/**
 * Contorul de aprobări se citește o singură dată, în layout-ul CRM-ului. Layout-ul
 * supraviețuiește navigării între secțiuni, deci badge-ul nu mai costă o
 * interogare la fiecare schimbare de tab — înainte rula pe fiecare randare.
 */
const PendingApprovalsContext = createContext(0);

export function CrmChrome({
  pendingApprovals,
  children,
}: {
  pendingApprovals: number;
  children: ReactNode;
}) {
  return (
    <PendingApprovalsContext value={pendingApprovals}>{children}</PendingApprovalsContext>
  );
}

const menuIcons: Record<string, LucideIcon> = {
  ArrowRightLeft,
  BarChart3,
  Handshake,
  Layers,
  PackageSearch,
  Users,
};

/** Nav-ul principal; secțiunea activă vine din URL, nu dintr-un prop. */
export function Sidebar({
  role,
  userName,
  userEmail,
}: {
  role: AppRole;
  userName: string | null;
  userEmail: string | null;
}) {
  const pendingApprovals = useContext(PendingApprovalsContext);
  const activeSectionId = sectionFromPathname(usePathname());
  const visibleGroups = navigationGroups
    .filter((group) => !group.adminOnly || canManageStaff(role))
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => canViewSection(role, section)),
    }))
    .filter((group) => group.sections.length > 0);
  const userLabel = userName || userEmail || "Utilizator";

  return (
    <nav className="flex flex-col gap-2 px-3 py-2 lg:min-h-screen lg:gap-0 lg:px-3 lg:py-4">
      <div className="flex items-center justify-between gap-3 px-1 pb-1 lg:block lg:border-b lg:border-[#efeeeb] lg:px-2 lg:pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Nadin Auto"
            className="h-7 w-10 shrink-0 object-contain"
          />
          <p className="crm-nav-label truncate text-[15px] font-semibold tracking-tight text-[#1b1a17]">
            Nadin Auto
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <div className="rounded-full border border-[#e8e7e3] bg-[#f6f6f4] px-2.5 py-1 text-[11px] font-semibold text-[#6f6b63]">
            {role}
          </div>
          <ChangePasswordDialog compact />
          <TrustedDeviceControl compact />
          <LogoutButton compact />
        </div>
      </div>

      <div className="mobile-nav-scroll -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-3">
        {visibleGroups.map((group) => {
          const Icon = menuIcons[group.icon];
          const active = group.sections.includes(activeSectionId);

          return (
            <Link
              key={group.id}
              className={`motion-nav-link flex min-w-max items-center gap-2.5 rounded-lg px-3 py-2 text-sm lg:min-w-0 ${
                active
                  ? "bg-[#f1efe9] font-semibold text-[#1b1a17]"
                  : "font-medium text-[#6f6b63] hover:bg-[#f6f6f4] hover:text-[#1b1a17]"
              }`}
              href={crmSectionHref(group.sections[0])}
              title={group.label}
            >
              <Icon
                className={`size-4 shrink-0 ${active ? "text-[#2e90fa]" : "text-[#98948b]"}`}
                aria-hidden="true"
              />
              <span className="crm-nav-label whitespace-nowrap">{group.label}</span>
              {pendingApprovals > 0 && group.sections.includes("aprobari") ? (
                <span className="crm-nav-badge ml-auto rounded-md bg-[#2e90fa] px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-white">
                  {pendingApprovals}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto hidden border-t border-[#efeeeb] px-2 pt-3 lg:block">
        <SidebarCollapseButton />
        <div className="crm-account mt-2 flex items-center justify-between gap-2">
          <div className="crm-account-meta min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#1b1a17]">{userLabel}</p>
            <p className="mt-0.5 text-xs font-medium text-[#98948b]">{role}</p>
          </div>
          <div className="crm-account-actions flex items-center gap-1.5">
            <ChangePasswordDialog compact />
            <TrustedDeviceControl compact />
            <LogoutButton compact />
          </div>
        </div>
      </div>
    </nav>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        aria-label="Ieșire din cont"
        title="Ieșire din cont"
        className={`button-secondary inline-flex items-center justify-center rounded-xl border border-[#e8e7e3] bg-white text-sm font-semibold text-[#6f6b63] hover:border-[#dcdad4] hover:text-[#1b1a17] ${
          compact ? "size-8" : "mt-3 w-full gap-2 px-3 py-2"
        }`}
      >
        <LogOut className="size-4" aria-hidden="true" />
        {compact ? null : <span>Ieșire</span>}
      </button>
    </form>
  );
}

/** Sub-tab-urile grupului curent. */
export function SectionTabs({ role }: { role: AppRole }) {
  const pendingApprovals = useContext(PendingApprovalsContext);
  const activeSectionId = sectionFromPathname(usePathname());
  const group = groupForSection(activeSectionId);
  const sections = group?.sections.filter((section) => canViewSection(role, section)) ?? [];
  if (sections.length <= 1) return null;

  return (
    <div className="border-b border-[#e8e7e3] bg-white px-4 lg:px-6">
      <div className="mobile-nav-scroll flex gap-1 overflow-x-auto py-2">
        {sections.map((section) => {
          const active = section === activeSectionId;
          return (
            <Link
              key={section}
              href={crmSectionHref(section)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[#1b1a17] text-white"
                  : "text-[#6f6b63] hover:bg-[#f1f0ed] hover:text-[#1b1a17]"
              }`}
            >
              {sectionLabel(section)}
              {section === "aprobari" && pendingApprovals > 0 ? (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums ${
                    active ? "bg-[#2e90fa] text-white" : "bg-[#dbebfe] text-[#175cd3]"
                  }`}
                >
                  {pendingApprovals}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
