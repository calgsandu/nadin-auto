"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  ChevronsUpDown,
  ClipboardList,
  FileText,
  LogOut,
  PackageMinus,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { RowMenu } from "@/app/components/row-menu";
import { ChangePasswordDialog } from "@/app/account/change-password-dialog";
import { TrustedDeviceControl } from "@/app/account/trusted-device-control";
import { SidebarCollapseButton } from "../sidebar-collapse";
import { crmSectionHref, sectionFromPathname } from "@/lib/crm/urls";
import { groupForSection, navigationGroups, sectionLabel } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
import { menuIcons, sectionIcon } from "./section-icons";
import type { AppRole } from "@/generated/prisma/enums";
import type { WorkspaceSectionId } from "@/lib/operations/workspace";

/**
 * Contoarele din meniu și din clopoțel (aprobări, de adus, proforme neachitate)
 * se citesc o singură dată, în layout-ul CRM-ului. Layout-ul supraviețuiește
 * navigării între secțiuni, deci nu costă o interogare la fiecare tab.
 */
export type NavCounts = Partial<Record<"aprobari" | "de-adus" | "conturi-plata" | "stoc-mic", number>>;

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
  // Grupurile din meniu se deschid/închid pe click, fără să schimbe pagina;
  // implicit e deschis doar grupul paginii curente.
  const [toggledGroups, setToggledGroups] = useState<Record<string, boolean>>({});
  useSearchShortcut();
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => canViewSection(role, section)),
    }))
    .filter((group) => group.sections.length > 0);
  const userLabel = userName || userEmail || "Utilizator";
  const initials = userLabel
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <nav aria-label="Meniu principal" className="crm-sidebar-nav flex flex-col gap-2 px-3 py-2 lg:h-full lg:gap-0 lg:px-3 lg:py-4">
      {/* Sigla și numele; butonul de restrângere stă jos, lângă cont. */}
      <div className="crm-sidebar-brand crm-account flex items-center justify-between gap-2 px-1 pb-1 lg:mb-5 lg:px-1.5 lg:pb-0">
        <Link href="/crm/produse" className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef4ff]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-5 w-7 object-contain" />
          </span>
          <span className="crm-nav-label truncate text-[1.0625rem] font-semibold tracking-tight text-[#0f172a]">
            Nadin Auto
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <ChangePasswordDialog compact />
          <TrustedDeviceControl compact />
          <LogoutButton compact />
        </div>
      </div>

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

      {/* Desktop: ce se face zilnic e la vedere; grupurile își deschid
          secțiunile sub ele, ca arbore, când ești într-una din ele. */}
      <div className="crm-sidebar-links hidden min-h-0 flex-1 overflow-y-auto lg:block">
        <div className="grid gap-0.5">
          {visibleGroups.map((group, index) => {
            const groupActive = group.sections.includes(activeSectionId);
            const groupOpen = toggledGroups[group.id] ?? groupActive;
            const caption = index === 0 ? "Lucru zilnic" : group.rare && !visibleGroups[index - 1]?.rare ? "Evidență" : null;
            return (
              <Fragment key={group.id}>
                {caption ? (
                  <p className={`crm-nav-caption px-3 pb-1.5 text-xs font-medium text-[#94a3b8] ${index === 0 ? "" : "mt-5"}`}>
                    {caption}
                  </p>
                ) : null}
                {group.display === "list" || group.sections.length === 1 ? (
                  group.sections.map((section) => {
                    const count = countFor(counts, section);
                    return (
                      <div key={section} className="crm-fly-item" onPointerEnter={placeFlyout} onFocus={placeFlyout} onClick={closeFlyout} onPointerLeave={reopenFlyout}>
                        <NavLink
                          active={section === activeSectionId}
                          badge={count}
                          href={crmSectionHref(section)}
                          icon={sectionIcon(section)}
                          label={sectionLabel(section)}
                        />
                        {/* Meniul restrâns: eticheta apare lângă iconiță la hover. */}
                        <span className="crm-fly crm-fly-pill" aria-hidden="true">
                          <span className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#0f172a] px-2.5 py-1.5 text-sm font-medium text-white shadow-lg">
                            {sectionLabel(section)}
                            {count > 0 ? (
                              <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums">
                                {count}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="crm-fly-item" onPointerEnter={placeFlyout} onFocus={placeFlyout} onClick={closeFlyout} onPointerLeave={reopenFlyout}>
                    <NavLink
                      active={groupActive}
                      parent
                      badge={group.sections.reduce((sum, section) => sum + countFor(counts, section), 0)}
                      badgeInTree={groupOpen}
                      highlightBadge={group.sections.includes("aprobari")}
                      href={crmSectionHref(group.sections[0])}
                      expanded={groupOpen}
                      onToggle={() => setToggledGroups((current) => ({ ...current, [group.id]: !groupOpen }))}
                      icon={menuIcons[group.icon]}
                      label={group.label}
                    />
                    {groupOpen ? (
                      <div className="crm-nav-sub mb-1.5 ml-[1.375rem] grid gap-0.5 border-l border-[#e5e9f0] pl-2.5">
                        {group.sections.map((section) => (
                          <SubLink key={section} section={section} active={section === activeSectionId} count={countFor(counts, section)} />
                        ))}
                      </div>
                    ) : null}
                    {/* Meniul restrâns: secțiunile grupului într-un meniu lateral. */}
                    <div className="crm-fly crm-fly-menu">
                      <div className="grid w-56 gap-0.5 rounded-xl border border-[#e5e9f0] bg-white p-1.5 shadow-[0_12px_32px_-12px_rgb(15_23_42/0.25)]">
                        <p className="px-2.5 pb-1 pt-1.5 text-sm font-semibold text-[#0f172a]">{group.label}</p>
                        {group.sections.map((section) => (
                          <SubLink key={section} section={section} active={section === activeSectionId} count={countFor(counts, section)} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Cine e logat; acțiunile contului stau într-un meniu. */}
      <div className="crm-sidebar-account hidden items-center gap-1 border-t border-[#e5e9f0] pt-3 lg:flex">
        <div className="min-w-0 flex-1">
          <RowMenu
            ariaLabel={`Contul meu: ${userLabel}`}
            label={userLabel}
            triggerClassName="crm-account-trigger flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-[#f1f4f9]"
            trigger={
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef4ff] text-xs font-semibold text-[#1d4ed8]">
                  {initials || "?"}
                </span>
                <span className="crm-account-meta min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#0f172a]">{userLabel}</span>
                  <span className="block truncate text-xs text-[#64748b]">{roleLabels[role]}</span>
                </span>
                <ChevronsUpDown className="crm-account-meta size-4 shrink-0 text-[#94a3b8]" aria-hidden="true" />
              </>
            }
          >
            <ChangePasswordDialog />
            <TrustedDeviceControl />
            <LogoutButton />
          </RowMenu>
        </div>
        <SidebarCollapseButton />
      </div>
    </nav>
  );
}

/**
 * Meniul restrâns: pill-ul și meniul lateral sunt `position: fixed` (lista de
 * linkuri are scroll și le-ar tăia), deci le punem în dreptul rândului când
 * intră mouse-ul sau focusul. Meniul nu iese din ecran pe jos.
 */
function placeFlyout(event: { currentTarget: HTMLElement }) {
  const item = event.currentTarget;
  const fly = item.querySelector<HTMLElement>(":scope > .crm-fly");
  if (!fly) return;
  const rect = item.getBoundingClientRect();
  const top = fly.classList.contains("crm-fly-menu")
    ? rect.top - 6
    : rect.top + (rect.height - fly.offsetHeight) / 2;
  fly.style.top = `${Math.max(8, Math.min(top, window.innerHeight - fly.offsetHeight - 8))}px`;
}

/**
 * Clic pe o secțiune = alegerea s-a făcut: meniul se închide chiar dacă
 * mouse-ul e încă pe el. Clicul pe rândul grupului (buton) îl lasă deschis.
 */
function closeFlyout(event: { currentTarget: HTMLElement; target: EventTarget }) {
  if (!(event.target as HTMLElement).closest("a")) return;
  event.currentTarget.setAttribute("data-fly-closed", "");
}

function reopenFlyout(event: { currentTarget: HTMLElement }) {
  event.currentTarget.removeAttribute("data-fly-closed");
}

function SubLink({ section, active, count }: { section: WorkspaceSectionId; active: boolean; count: number }) {
  return (
    <Link
      href={crmSectionHref(section)}
      aria-current={active ? "page" : undefined}
      className={`motion-nav-link flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
        active ? "bg-[#eef4ff] font-semibold text-[#1d4ed8]" : "text-[#475569] hover:bg-[#f1f4f9] hover:text-[#0f172a]"
      }`}
    >
      <span className="truncate">{sectionLabel(section)}</span>
      {count > 0 ? (
        <span className="ml-auto rounded-md bg-[#2563eb] px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function NavLink({
  active,
  parent = false,
  badge = 0,
  badgeInTree = false,
  highlightBadge = false,
  href,
  expanded,
  onToggle,
  icon: Icon,
  label,
}: {
  active: boolean;
  /** Rând de grup: activ înseamnă „ești într-o secțiune de sub el", nu pastila plină. */
  parent?: boolean;
  badge?: number;
  /** Grupul activ: secțiunile (cu contoarele lor) sunt deja în arbore, deci
   *  suma apare doar cu meniul restrâns, când arborele e ascuns. */
  badgeInTree?: boolean;
  /** Albastru = cere atenție (aprobări); gri = doar un număr de lucru. */
  highlightBadge?: boolean;
  href: string;
  /** Rând de grup pe desktop: lista de sub el e deschisă. */
  expanded?: boolean;
  /** Dat = rândul e buton care deschide/închide lista, nu link spre o pagină. */
  onToggle?: () => void;
  icon: LucideIcon;
  label: string;
}) {
  const filled = active && !parent;
  const className = `motion-nav-link relative flex min-w-max items-center gap-3 rounded-xl px-3 py-2 text-sm lg:min-w-0 ${
        filled
          ? "bg-[#2563eb] font-medium text-white shadow-[0_4px_12px_-4px_rgb(37_99_235/0.5)]"
          : active
            ? "crm-nav-parent-active font-semibold text-[#0f172a] max-lg:bg-[#2563eb] max-lg:font-medium max-lg:text-white"
            : "font-medium text-[#475569] hover:bg-[#f1f4f9] hover:text-[#0f172a]"
      }`;
  const content = (
    <>
      <Icon
        className={`size-[1.125rem] shrink-0 ${
          filled ? "text-white" : active ? "text-[#2563eb] max-lg:text-white" : "text-[#94a3b8]"
        }`}
        aria-hidden="true"
      />
      <span className="crm-nav-label truncate whitespace-nowrap">{label}</span>
      {parent ? (
        <ChevronDown
          className={`crm-nav-label ml-auto size-4 shrink-0 text-[#94a3b8] transition-transform max-lg:hidden ${(expanded ?? active) ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      ) : null}
      {badge > 0 ? (
        <span
          data-tone={highlightBadge ? "hi" : undefined}
          data-in-tree={badgeInTree || undefined}
          className={`crm-nav-badge rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ${parent ? "" : "ml-auto"} ${
            filled
              ? "bg-white/20 text-white"
              : highlightBadge
                ? "bg-[#2563eb] text-white"
                : "bg-[#f1f4f9] text-[#475569]"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </>
  );
  const ariaLabel = badge > 0 ? `${label} (${badge})` : label;
  if (onToggle) {
    return (
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        aria-expanded={expanded}
        aria-label={ariaLabel}
        className={`${className} w-full text-left`}
        onClick={onToggle}
      >
        {content}
      </button>
    );
  }
  return (
    <Link
      aria-current={active ? (parent ? "true" : "page") : undefined}
      className={className}
      href={href}
      aria-label={ariaLabel}
    >
      {content}
    </Link>
  );
}

/**
 * Căutarea de piese, mereu la îndemână: duce în Produse cu termenul scris.
 * Ctrl+K (sau ⌘K) o focusează de oriunde din CRM.
 */
/**
 * Ctrl+K (sau „/" când nu scrii într-un câmp) duce în căutarea din Produse, de
 * oriunde din CRM. Cu un panou deschis nu face nimic: ar pierde ciorna din ochi.
 */
function useSearchShortcut() {
  const router = useRouter();

  useEffect(() => {
    const focusSearch = () => {
      const input = document.querySelector<HTMLInputElement>("[data-catalog-search]");
      if (!input) return false;
      input.focus();
      input.select();
      return true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable;
      const shortcut =
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") ||
        (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey);
      if (!shortcut) return;
      const drawerOpen = Array.from(document.querySelectorAll<HTMLElement>(".motion-drawer-backdrop")).some(
        (backdrop) => backdrop.style.display !== "none",
      );
      if (drawerOpen) return;
      event.preventDefault();
      if (focusSearch()) return;
      router.push("/crm/produse");
      // Pagina vine din server: așteptăm câmpul cel mult câteva secunde.
      let tries = 0;
      const wait = window.setInterval(() => {
        tries += 1;
        if (focusSearch() || tries > 50) window.clearInterval(wait);
      }, 100);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        aria-label="Ieșire din cont"
        title="Ieșire din cont"
        className={`button-secondary inline-flex items-center justify-center rounded-lg border border-[#e5e9f0] bg-white text-sm font-semibold text-[#475569] hover:border-[#cbd5e1] hover:text-[#0f172a] ${
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
                  ? "border-[#2563eb] text-[#1d4ed8]"
                  : "border-transparent text-[#64748b] hover:border-[#cbd5e1] hover:text-[#0f172a]"
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
    { key: "aprobari", label: "Operațiuni de aprobat", icon: ShieldCheck, href: crmSectionHref("aprobari") },
    { key: "de-adus", label: "Piese de adus în 110A", icon: ClipboardList, href: crmSectionHref("de-adus") },
    { key: "conturi-plata", label: "Proforme neachitate", icon: FileText, href: crmSectionHref("conturi-plata") },
    { key: "stoc-mic", label: "Piese aproape terminate", icon: PackageMinus, href: "/crm/produse?stoc=mic" },
  ] as const;
  // „Aproape terminate" e o listă de urmărit, nu o sarcină a zilei: apare în
  // meniu, dar nu umflă numărul de pe clopoțel.
  const total = items
    .filter((item) => item.key !== "stoc-mic")
    .reduce((sum, item) => sum + countFor(counts, item.key), 0);
  const visible = items.filter((item) => countFor(counts, item.key) > 0);

  return (
    <RowMenu ariaLabel={total > 0 ? `De făcut: ${total}` : "Nimic de făcut"} badge={total} icon={Bell} label="De făcut" size="header">
      {visible.length === 0 ? (
        <p className="px-2.5 py-2 text-sm text-[#475569]">Nimic în așteptare.</p>
      ) : (
        visible.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.key} href={item.href} className="text-[#0f172a]">
              <Icon className="size-4 text-[#64748b]" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              <span className="font-semibold tabular-nums">{countFor(counts, item.key)}</span>
            </Link>
          );
        })
      )}
    </RowMenu>
  );
}
