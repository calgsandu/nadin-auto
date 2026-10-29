"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  CalendarRange,
  Car,
  ClipboardList,
  FileText,
  Handshake,
  Home,
  Layers,
  LogOut,
  PackagePlus,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { ChangePasswordDialog } from "@/app/account/change-password-dialog";
import { TrustedDeviceControl } from "@/app/account/trusted-device-control";
import { SidebarCollapseButton } from "../sidebar-collapse";
import { crmSectionHref, sectionFromPathname } from "@/lib/crm/urls";
import { groupForSection, navigationEntries, navigationGroups, sectionLabel } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
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
  Boxes,
  CalendarRange,
  Car,
  ClipboardList,
  FileText,
  Handshake,
  Home,
  Layers,
  PackagePlus,
  PackageSearch,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
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
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => canViewSection(role, section)),
    }))
    .filter((group) => group.sections.length > 0);
  const listGroups = visibleGroups.filter((group) => group.display === "list");
  const tabGroups = visibleGroups.filter((group) => group.display === "tabs");
  const userLabel = userName || userEmail || "Utilizator";

  return (
    <nav aria-label="Meniu principal" className="flex flex-col gap-2 px-3 py-2 lg:h-full lg:gap-0 lg:px-2.5 lg:py-3">
      <div className="flex items-center justify-between gap-3 px-1 pb-1 lg:block lg:px-1.5 lg:pb-2">
        <Link href="/crm/azi" className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Nadin Auto"
            className="h-7 w-10 shrink-0 object-contain"
          />
          <span className="crm-nav-label truncate text-[15px] font-semibold tracking-tight text-[#18181b]">
            Nadin Auto
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <div className="rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-2.5 py-1 text-[11px] font-semibold text-[#52525b]">
            {role}
          </div>
          <ChangePasswordDialog compact />
          <TrustedDeviceControl compact />
          <LogoutButton compact />
        </div>
      </div>

      <SidebarSearch />

      {/* Telefon: un rând de grupuri; secțiunile fiecărui grup apar ca tab-uri sus. */}
      <div className="mobile-nav-scroll -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 lg:hidden">
        {visibleGroups.map((group) => (
          <NavLink
            key={group.id}
            active={group.sections.includes(activeSectionId)}
            badge={group.sections.includes("aprobari") ? pendingApprovals : 0}
            href={crmSectionHref(group.sections[0])}
            icon={menuIcons[group.icon]}
            label={group.label}
          />
        ))}
      </div>

      {/* Desktop: munca de zi cu zi la vedere, câte o secțiune pe rând. */}
      <div className="hidden min-h-0 flex-1 overflow-y-auto pt-1 lg:block">
        {listGroups.map((group) => (
          <div key={group.id} className="pb-2.5">
            <p className="crm-nav-heading px-2.5 pb-1 text-xs font-semibold text-[#71717a]">
              {group.label}
            </p>
            <div className="grid gap-px">
              {group.sections.map((section) => (
                <NavLink
                  key={section}
                  active={section === activeSectionId}
                  href={crmSectionHref(section)}
                  icon={menuIcons[navigationEntries.find((entry) => entry.section === section)?.icon ?? "FileText"]}
                  label={sectionLabel(section)}
                />
              ))}
            </div>
          </div>
        ))}
        {tabGroups.length > 0 ? (
          <div className="pb-2.5">
            <p className="crm-nav-heading px-2.5 pb-1 text-xs font-semibold text-[#71717a]">
              Mai mult
            </p>
            <div className="grid gap-px">
              {tabGroups.map((group) => (
                <NavLink
                  key={group.id}
                  active={group.sections.includes(activeSectionId)}
                  badge={group.sections.includes("aprobari") ? pendingApprovals : 0}
                  href={crmSectionHref(group.sections[0])}
                  icon={menuIcons[group.icon]}
                  label={group.label}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden border-t border-[#e4e4e7] px-1.5 pt-2.5 lg:block">
        <SidebarCollapseButton />
        <div className="crm-account mt-2 flex items-center justify-between gap-2">
          <div className="crm-account-meta min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#18181b]">{userLabel}</p>
            <p className="mt-0.5 text-xs font-medium text-[#71717a]">{role}</p>
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

function NavLink({
  active,
  badge = 0,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  badge?: number;
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`motion-nav-link flex min-w-max items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm lg:min-w-0 lg:py-[0.3125rem] ${
        active
          ? "bg-[#eff6ff] font-semibold text-[#1d4ed8]"
          : "font-medium text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#18181b]"
      }`}
      href={href}
      title={label}
    >
      <Icon
        className={`size-4 shrink-0 ${active ? "text-[#2563eb]" : "text-[#71717a]"}`}
        aria-hidden="true"
      />
      <span className="crm-nav-label truncate whitespace-nowrap">{label}</span>
      {badge > 0 ? (
        <span className="crm-nav-badge ml-auto rounded-md bg-[#2563eb] px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Căutarea de piese, mereu la îndemână: duce în Produse cu termenul scris.
 * Ctrl+K (sau ⌘K) o focusează de oriunde din CRM.
 */
function SidebarSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <form action="/crm/produse" method="get" role="search" className="crm-nav-search hidden px-1 pb-2 lg:block">
      <label className="flex h-8 items-center gap-2 rounded-md border border-[#e4e4e7] bg-[#fafafa] px-2 text-[#71717a] focus-within:border-[#2563eb] focus-within:bg-white">
        <Search className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="sr-only">Caută piesă</span>
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#18181b] outline-none placeholder:text-[#71717a]"
          name="q"
          placeholder="Caută piesă…"
        />
        <kbd className="rounded border border-[#e4e4e7] bg-white px-1 font-sans text-[10px] font-medium">Ctrl K</kbd>
      </label>
    </form>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        aria-label="Ieșire din cont"
        title="Ieșire din cont"
        className={`button-secondary inline-flex items-center justify-center rounded-xl border border-[#e4e4e7] bg-white text-sm font-semibold text-[#52525b] hover:border-[#d4d4d8] hover:text-[#18181b] ${
          compact ? "size-8" : "mt-3 w-full gap-2 px-3 py-2"
        }`}
      >
        <LogOut className="size-4" aria-hidden="true" />
        {compact ? null : <span>Ieșire</span>}
      </button>
    </form>
  );
}

/**
 * Sub-tab-urile grupului curent. Stau în bara de titlu (vezi `CrmHeader`), nu
 * într-o bară proprie: tab-ul activ spune deja unde ești, iar bara în plus
 * costa ~50px de ecran pe fiecare pagină.
 */
export function SectionTabs({ role }: { role: AppRole }) {
  const pendingApprovals = useContext(PendingApprovalsContext);
  const activeSectionId = sectionFromPathname(usePathname());
  const group = groupForSection(activeSectionId);
  const sections = group?.sections.filter((section) => canViewSection(role, section)) ?? [];
  if (sections.length <= 1) return null;

  return (
    <nav aria-label="Secțiuni" className="mobile-nav-scroll -mx-1 overflow-x-auto px-1">
      <div className="flex gap-1">
        {sections.map((section) => {
          const active = section === activeSectionId;
          return (
            <Link
              key={section}
              href={crmSectionHref(section)}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-[#18181b] text-white"
                  : "text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b]"
              }`}
            >
              {sectionLabel(section)}
              {section === "aprobari" && pendingApprovals > 0 ? (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums ${
                    active ? "bg-[#2563eb] text-white" : "bg-[#dbeafe] text-[#1d4ed8]"
                  }`}
                >
                  {pendingApprovals}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
