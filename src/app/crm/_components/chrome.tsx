"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  PackageMinus,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { RowMenu } from "@/app/components/row-menu";
import { ChangePasswordDialog } from "@/app/account/change-password-dialog";
import { TrustedDeviceControl } from "@/app/account/trusted-device-control";
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


/** Etichete scurte pentru bara de sus, unde fiecare pastilă costă lățime. */
const pillLabels: Partial<Record<WorkspaceSectionId, string>> = {
  "la-comanda": "Comenzi",
};

/**
 * Bara de sus: sigla, pastilele de navigare, căutarea, clopoțelul și contul.
 * Grupurile folosite zilnic („list") își arată fiecare secțiune ca pastilă;
 * celelalte au o singură pastilă, iar secțiunile lor apar în antetul paginii.
 * Pe telefon pastilele se strâng în butonul „Meniu".
 */
export function TopBar({
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
  const focusSearch = useSearchShortcut();
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => canViewSection(role, section)),
    }))
    .filter((group) => group.sections.length > 0);
  const pills = visibleGroups.flatMap((group) =>
    group.display === "list" || group.sections.length === 1
      ? group.sections.map((section) => ({
          key: section,
          href: crmSectionHref(section),
          label: pillLabels[section] ?? sectionLabel(section),
          icon: sectionIcon(section),
          active: section === activeSectionId,
          count: countFor(counts, section),
        }))
      : [
          {
            key: group.id,
            href: crmSectionHref(group.sections[0]),
            label: group.label,
            icon: menuIcons[group.icon],
            active: group.sections.includes(activeSectionId),
            count: group.sections.reduce((sum, section) => sum + countFor(counts, section), 0),
          },
        ],
  );
  const userLabel = userName || userEmail || "Utilizator";
  const initials = userLabel
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-16 items-center gap-3 px-4 lg:gap-3 lg:px-6 xl:gap-5">
      <Link href="/crm/produse" className="flex shrink-0 items-center gap-2.5" aria-label="Nadin Auto">
        <span className="grid size-9 place-items-center rounded-full bg-[#1a1917]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-4 w-6 object-contain brightness-0 invert" />
        </span>
        <span className="text-[1.125rem] font-semibold tracking-tight text-[#1a1917] lg:max-xl:hidden">Nadin Auto</span>
      </Link>

      <nav aria-label="Meniu principal" className="mobile-nav-scroll hidden min-w-0 flex-1 overflow-x-auto lg:block">
        <div className="flex w-max gap-1 py-1 xl:gap-1.5">
          {pills.map(({ key, href, label, icon: Icon, active, count }) => (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={count > 0 ? `${label} (${count})` : label}
              className={`motion-nav-link inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium xl:px-3.5 ${
                active
                  ? "bg-[#1a1917] text-white"
                  : "border border-[#e6e4df] bg-white text-[#1a1917] hover:border-[#d6d3d1]"
              }`}
            >
              <Icon className={`size-4 shrink-0 max-2xl:hidden ${active ? "text-white" : "text-[#57534e]"}`} aria-hidden="true" />
              {label}
              {count > 0 ? (
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold leading-none tabular-nums ${
                    active ? "bg-white text-[#1a1917]" : "bg-[#1a1917] text-white"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={focusSearch}
          aria-label="Caută piese (Ctrl K)"
          title="Caută piese (Ctrl K)"
          className="grid size-9 place-items-center rounded-full border border-[#e6e4df] bg-white text-[#1a1917] hover:border-[#d6d3d1]"
        >
          <Search className="size-4" aria-hidden="true" />
        </button>
        <HeaderNotifications />
        <div className="hidden lg:block">
          <RowMenu
            ariaLabel={`Contul meu: ${userLabel}`}
            label={userLabel}
            triggerClassName="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-white"
            trigger={
              <>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e4e2dc] text-xs font-semibold text-[#1a1917]">
                  {initials || "?"}
                </span>
                <span className="min-w-0 max-2xl:hidden">
                  <span className="block max-w-40 truncate text-sm font-semibold leading-tight text-[#1a1917]">{userLabel}</span>
                  <span className="block text-xs leading-tight text-[#78716c]">{roleLabels[role]}</span>
                </span>
                <ChevronDown className="size-4 shrink-0 text-[#a8a29e]" aria-hidden="true" />
              </>
            }
          >
            <ChangePasswordDialog />
            <TrustedDeviceControl />
            <LogoutButton />
          </RowMenu>
        </div>
        <MobileMenu
          groups={visibleGroups}
          activeSectionId={activeSectionId}
          counts={counts}
          userLabel={userLabel}
          roleLabel={roleLabels[role]}
        />
      </div>
    </div>
  );
}

/**
 * Telefon: un singur buton „Meniu" în locul rândului de grupuri derulat
 * lateral. Deschide tot meniul (grupuri și secțiuni, ca pe desktop) plus
 * contul. `<dialog>` nativ: Escape, focus și fundalul blocat vin gratis.
 */
function MobileMenu({
  groups,
  activeSectionId,
  counts,
  userLabel,
  roleLabel,
}: {
  groups: { id: string; label: string; icon: keyof typeof menuIcons; display?: string; sections: WorkspaceSectionId[] }[];
  activeSectionId: WorkspaceSectionId;
  counts: NavCounts;
  userLabel: string;
  roleLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const total = groups.reduce(
    (sum, group) => sum + group.sections.reduce((inner, section) => inner + countFor(counts, section), 0),
    0,
  );

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="relative inline-flex h-9 items-center gap-2 rounded-full border border-[#e6e4df] bg-white px-3.5 text-sm font-semibold text-[#1a1917]"
        onClick={() => dialog.current?.showModal()}
      >
        <Menu className="size-4" aria-hidden="true" />
        Meniu
        {total > 0 ? (
          <span className="rounded-md bg-[#1a1917] px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-white">
            {total}
          </span>
        ) : null}
      </button>
      <dialog
        ref={dialog}
        aria-label="Meniu"
        className="crm-mobile-menu m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 backdrop:bg-black/30"
        // Orice alegere (secțiune, parolă, ieșire) închide meniul. Dialogul de
        // parolă se deschide prin portal și ar rămâne sub un <dialog> modal.
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a, button")) dialog.current?.close();
        }}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[#e6e4df] bg-white px-4 py-3">
          <span className="text-[1.0625rem] font-semibold tracking-tight text-[#1a1917]">Meniu</span>
          <button
            type="button"
            aria-label="Închide meniul"
            className="grid size-9 place-items-center rounded-lg border border-[#e6e4df] text-[#57534e]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Secțiuni" className="grid gap-1 px-3 py-4">
          {groups.map((group) =>
            group.display === "list" || group.sections.length === 1 ? (
              <div key={group.id} className="grid gap-0.5">
                {group.sections.map((section) => (
                  <NavLink
                    key={section}
                    active={section === activeSectionId}
                    badge={countFor(counts, section)}
                    href={crmSectionHref(section)}
                    icon={sectionIcon(section)}
                    label={sectionLabel(section)}
                  />
                ))}
              </div>
            ) : (
              // Grupurile stau strânse; se deschide doar cel al paginii curente.
              <details key={group.id} className="group" open={group.sections.includes(activeSectionId)}>
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-[#57534e] [&::-webkit-details-marker]:hidden">
                  {(() => {
                    const Icon = menuIcons[group.icon];
                    return <Icon className="size-[1.125rem] shrink-0 text-[#a8a29e]" aria-hidden="true" />;
                  })()}
                  <span className="group-open:font-semibold group-open:text-[#1a1917]">{group.label}</span>
                  {(() => {
                    const sum = group.sections.reduce((total, section) => total + countFor(counts, section), 0);
                    return sum > 0 ? (
                      <span className="rounded-md bg-[#f3f2ef] px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-[#57534e] group-open:hidden">
                        {sum}
                      </span>
                    ) : null;
                  })()}
                  <ChevronDown className="ml-auto size-4 shrink-0 text-[#a8a29e] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mb-1 ml-[1.375rem] grid gap-0.5 border-l border-[#e6e4df] pl-2.5">
                  {group.sections.map((section) => (
                    <SubLink key={section} section={section} active={section === activeSectionId} count={countFor(counts, section)} />
                  ))}
                </div>
              </details>
            ),
          )}
        </nav>
        <div className="grid gap-2 border-t border-[#e6e4df] px-4 py-4">
          <p className="text-sm">
            <span className="font-semibold text-[#1a1917]">{userLabel}</span>
            <span className="text-[#78716c]"> {roleLabel}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <ChangePasswordDialog />
            <TrustedDeviceControl />
            <LogoutButton />
          </div>
        </div>
      </dialog>
    </div>
  );
}

function SubLink({ section, active, count }: { section: WorkspaceSectionId; active: boolean; count: number }) {
  return (
    <Link
      href={crmSectionHref(section)}
      aria-current={active ? "page" : undefined}
      className={`motion-nav-link flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
        active ? "bg-[#ecebe6] font-semibold text-[#34322e]" : "text-[#57534e] hover:bg-[#f3f2ef] hover:text-[#1a1917]"
      }`}
    >
      <span className="truncate">{sectionLabel(section)}</span>
      {count > 0 ? (
        <span className="ml-auto rounded-md bg-[#1a1917] px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-white">
          {count}
        </span>
      ) : null}
    </Link>
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
      aria-label={badge > 0 ? `${label} (${badge})` : label}
      href={href}
      className={`motion-nav-link flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium ${
        active ? "bg-[#1a1917] text-white" : "text-[#57534e] hover:bg-[#f3f2ef] hover:text-[#1a1917]"
      }`}
    >
      <Icon className={`size-[1.125rem] shrink-0 ${active ? "text-white" : "text-[#a8a29e]"}`} aria-hidden="true" />
      <span className="truncate">{label}</span>
      {badge > 0 ? (
        <span
          className={`ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold leading-none tabular-nums ${
            active ? "bg-white text-[#1a1917]" : "bg-[#1a1917] text-white"
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
/**
 * Ctrl+K (sau „/" când nu scrii într-un câmp) duce în căutarea din Produse, de
 * oriunde din CRM. Cu un panou deschis nu face nimic: ar pierde ciorna din ochi.
 */
function useSearchShortcut() {
  const router = useRouter();

  const open = useCallback(() => {
    const focusSearch = () => {
      const input = document.querySelector<HTMLInputElement>("[data-catalog-search]");
      if (!input) return false;
      input.focus();
      input.select();
      return true;
    };
    if (focusSearch()) return;
    router.push("/crm/produse");
    // Pagina vine din server: așteptăm câmpul cel mult câteva secunde.
    let tries = 0;
    const wait = window.setInterval(() => {
      tries += 1;
      if (focusSearch() || tries > 50) window.clearInterval(wait);
    }, 100);
  }, [router]);

  useEffect(() => {
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
      open();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return open;
}

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        aria-label="Ieșire din cont"
        title="Ieșire din cont"
        className="button-secondary inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#e6e4df] bg-white px-3 py-2 text-sm font-semibold text-[#57534e] hover:border-[#d6d3d1] hover:text-[#1a1917]"
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span>Ieșire</span>
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
    <nav aria-label="Secțiuni" className="mobile-nav-scroll max-w-full overflow-x-auto">
      <div className="flex w-max gap-0.5 rounded-full border border-[#e6e4df] bg-white p-1">
        {sections.map((section) => {
          const active = section === activeSectionId;
          const count = countFor(counts, section);
          return (
            <Link
              key={section}
              href={crmSectionHref(section)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors ${
                active ? "bg-[#1a1917] text-white" : "text-[#57534e] hover:bg-[#f3f2ef] hover:text-[#1a1917]"
              }`}
            >
              {sectionLabel(section)}
              {count > 0 ? (
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold leading-none tabular-nums ${
                    active ? "bg-white text-[#1a1917]" : "bg-[#ecebe6] text-[#1a1917]"
                  }`}
                >
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
        <p className="px-2.5 py-2 text-sm text-[#57534e]">Nimic în așteptare.</p>
      ) : (
        visible.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.key} href={item.href} className="text-[#1a1917]">
              <Icon className="size-4 text-[#78716c]" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              <span className="font-semibold tabular-nums">{countFor(counts, item.key)}</span>
            </Link>
          );
        })
      )}
    </RowMenu>
  );
}
