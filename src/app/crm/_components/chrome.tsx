"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  ArrowRightLeft,
  Bell,
  ChevronsUpDown,
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
import { RowMenu } from "@/app/components/row-menu";
import { ChangePasswordDialog } from "@/app/account/change-password-dialog";
import { TrustedDeviceControl } from "@/app/account/trusted-device-control";
import { SidebarCollapseButton } from "../sidebar-collapse";
import { crmSectionHref, sectionFromPathname } from "@/lib/crm/urls";
import { groupForSection, navigationEntries, navigationGroups, sectionLabel } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";

/**
 * Contoarele din meniu și din clopoțel (aprobări, de adus, proforme neachitate)
 * se citesc o singură dată, în layout-ul CRM-ului. Layout-ul supraviețuiește
 * navigării între secțiuni, deci nu costă o interogare la fiecare tab.
 */
export type NavCounts = Partial<Record<"aprobari" | "de-adus" | "conturi-plata", number>>;

const NavCountsContext = createContext<NavCounts>({});

export function CrmChrome({
  counts,
  children,
}: {
  counts: NavCounts;
  children: ReactNode;
}) {
  return <NavCountsContext value={counts}>{children}</NavCountsContext>;
}

function countFor(counts: NavCounts, section: string) {
  return counts[section as keyof NavCounts] ?? 0;
}

const roleLabels: Record<AppRole, string> = {
  ADMIN: "Administrator",
  DIRECTOR: "Director",
  ANGAJAT: "Angajat",
};

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
  const counts = useContext(NavCountsContext);
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
  const initials = userLabel
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <nav aria-label="Meniu principal" className="flex flex-col gap-2 px-3 py-2 lg:h-full lg:gap-0 lg:px-2.5 lg:py-2">
      {/* Cartea firmei: sigla, numele și butonul de restrângere a meniului. */}
      <div className="crm-account flex items-center justify-between gap-2 px-1 pb-1 lg:mb-2 lg:rounded-xl lg:border lg:border-[#e4e4e7] lg:bg-white lg:p-2 lg:shadow-[0_1px_2px_rgb(24_24_27/0.04)]">
        <Link href="/crm/azi" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f4f4f5] ring-1 ring-[#e4e4e7]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-5 w-7 object-contain" />
          </span>
          <span className="crm-nav-label min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-[#18181b]">Nadin Auto</span>
            <span className="block truncate text-xs text-[#71717a]">Piese auto</span>
          </span>
        </Link>
        <div className="hidden lg:block">
          <SidebarCollapseButton />
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
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
            badge={group.sections.reduce((sum, section) => sum + countFor(counts, section), 0)}
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
            <p className="crm-nav-heading px-2.5 pb-1 text-xs font-medium text-[#71717a]">
              {group.label}
            </p>
            <div className="grid gap-px">
              {group.sections.map((section) => (
                <NavLink
                  key={section}
                  active={section === activeSectionId}
                  badge={countFor(counts, section)}
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
            <p className="crm-nav-heading px-2.5 pb-1 text-xs font-medium text-[#71717a]">Mai mult</p>
            <div className="grid gap-px">
              {tabGroups.map((group) => (
                <NavLink
                  key={group.id}
                  active={group.sections.includes(activeSectionId)}
                  badge={group.sections.reduce((sum, section) => sum + countFor(counts, section), 0)}
                  highlightBadge={group.sections.includes("aprobari")}
                  href={crmSectionHref(group.sections[0])}
                  icon={menuIcons[group.icon]}
                  label={group.label}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Cine e logat, cu acțiunile contului ca iconițe. */}
      <div className="crm-account hidden items-center gap-2 border-t border-[#e4e4e7] px-1.5 pt-2.5 lg:flex">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e0e7ff] text-xs font-semibold text-[#3730a3]">
          {initials || "?"}
        </span>
        <div className="crm-account-meta min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#18181b]">{userLabel}</p>
          <p className="truncate text-xs text-[#71717a]">{roleLabels[role]}</p>
        </div>
        {/* Acțiunile contului stau într-un meniu: trei iconițe tăiau numele. */}
        <div className="crm-account-actions">
          <RowMenu ariaLabel="Contul meu" icon={ChevronsUpDown} label={userLabel}>
            <ChangePasswordDialog />
            <TrustedDeviceControl />
            <LogoutButton />
          </RowMenu>
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  active,
  badge = 0,
  highlightBadge = false,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  badge?: number;
  /** Albastru = cere atenție (aprobări); gri = doar un număr de lucru. */
  highlightBadge?: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`motion-nav-link relative flex min-w-max items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm lg:min-w-0 lg:py-[0.3125rem] ${
        active
          ? "bg-white font-semibold text-[#18181b] shadow-[0_1px_2px_rgb(24_24_27/0.06)] ring-1 ring-[#e4e4e7] lg:before:absolute lg:before:-left-2.5 lg:before:inset-y-1.5 lg:before:w-[3px] lg:before:rounded-r-full lg:before:bg-[#2563eb]"
          : "font-medium text-[#3f3f46] hover:bg-white/70 hover:text-[#18181b]"
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
        <span
          className={`crm-nav-badge ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ${
            highlightBadge ? "bg-[#2563eb] text-white" : "border border-[#e4e4e7] bg-white text-[#52525b]"
          }`}
        >
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
    <form action="/crm/produse" method="get" role="search" className="crm-nav-search hidden pb-2 lg:block">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-2.5 text-[#71717a] focus-within:border-[#2563eb]">
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
        className={`button-secondary inline-flex items-center justify-center rounded-lg border border-[#e4e4e7] bg-white text-sm font-semibold text-[#52525b] hover:border-[#d4d4d8] hover:text-[#18181b] ${
          compact ? "size-8" : "w-full gap-2 px-3 py-2"
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
  const counts = useContext(NavCountsContext);
  const activeSectionId = sectionFromPathname(usePathname());
  const group = groupForSection(activeSectionId);
  const sections = group?.sections.filter((section) => canViewSection(role, section)) ?? [];
  if (sections.length <= 1) return null;

  return (
    <nav aria-label="Secțiuni" className="mobile-nav-scroll -mb-px overflow-x-auto">
      <div className="flex gap-4">
        {sections.map((section) => {
          const active = section === activeSectionId;
          const count = countFor(counts, section);
          return (
            <Link
              key={section}
              href={crmSectionHref(section)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2 pt-1 text-sm font-medium transition-colors ${
                active
                  ? "border-[#18181b] text-[#18181b]"
                  : "border-transparent text-[#71717a] hover:border-[#d4d4d8] hover:text-[#18181b]"
              }`}
            >
              {sectionLabel(section)}
              {count > 0 ? (
                <span className="rounded-md bg-[#eff6ff] px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-[#1d4ed8]">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Clopoțelul din antet: tot ce așteaptă o mână de om, cu legătura spre locul
 * unde se rezolvă. Numărul de pe el e suma contoarelor.
 */
export function HeaderNotifications() {
  const counts = useContext(NavCountsContext);
  const items = [
    { section: "aprobari", label: "Operațiuni de aprobat", icon: ShieldCheck },
    { section: "de-adus", label: "Piese de adus în 110A", icon: ClipboardList },
    { section: "conturi-plata", label: "Proforme neachitate", icon: FileText },
  ] as const;
  const total = items.reduce((sum, item) => sum + countFor(counts, item.section), 0);

  return (
    <RowMenu ariaLabel={total > 0 ? `De făcut: ${total}` : "Nimic de făcut"} badge={total} icon={Bell} label="De făcut" size="header">
      {total === 0 ? (
        <p className="px-2.5 py-2 text-sm text-[#52525b]">Nimic în așteptare.</p>
      ) : (
        items
          .filter((item) => countFor(counts, item.section) > 0)
          .map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.section} href={crmSectionHref(item.section)} className="text-[#18181b]">
                <Icon className="size-4 text-[#71717a]" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                <span className="font-semibold tabular-nums">{countFor(counts, item.section)}</span>
              </Link>
            );
          })
      )}
    </RowMenu>
  );
}
