import Link from "next/link";
import { Suspense } from "react";
import {
  ChevronRight,
  ClipboardCheck,
  FileText,
  PackagePlus,
  PackageSearch,
  Search,
  ShoppingCart,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { getTodayData, type TodayData } from "@/lib/crm/today";
import { lineDescription } from "@/lib/operations/line-display";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";
import { canCreateSales, canViewSection, canWriteCatalog } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";
import { requireCrmSection } from "../_components/guard";
import { documentTotalLei } from "../_components/documents-table";
import { formatMoney, formatNumber } from "../_components/format";
import { WorkspaceSkeleton } from "../_components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dayFormat = new Intl.DateTimeFormat("ro-MD", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Chisinau",
});
const timeFormat = new Intl.DateTimeFormat("ro-MD", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Chisinau",
});

/**
 * Pagina de start. Răspunde la „ce fac acum?": caută o piesă, pornește una
 * din operațiunile de zi cu zi, vezi ce așteaptă rezolvare și ce s-a vândut.
 */
export default async function TodayPage() {
  const appUser = await requireCrmSection("azi");
  const dataPromise = getTodayData(appUser.role);
  const firstName = (appUser.name ?? "").trim().split(/\s+/)[0];

  return (
    <section className="motion-page mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#18181b]">
          {firstName ? `Bună ziua, ${firstName}` : "Bună ziua"}
        </h1>
        <p className="mt-0.5 text-sm text-[#52525b] first-letter:uppercase">{dayFormat.format(new Date())}</p>
      </div>

      {/* Căutarea duce în Produse, cu aceleași reguli (cod, mașină, an). */}
      <form action="/crm/produse" method="get" role="search">
        <label className="flex h-12 items-center gap-3 rounded-xl border border-[#d4d4d8] bg-white px-4 shadow-sm focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#2563eb]/10">
          <Search className="size-5 shrink-0 text-[#71717a]" aria-hidden="true" />
          <span className="sr-only">Caută o piesă</span>
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-base text-[#18181b] outline-none placeholder:text-[#71717a]"
            name="q"
            placeholder="Ce piesă cauți? Scrie codul sau mașina — ex. „golf 5 stop”"
          />
          <span className="hidden text-xs font-medium text-[#71717a] sm:inline">Enter</span>
        </label>
      </form>

      <QuickActions role={appUser.role} />

      <Suspense fallback={<WorkspaceSkeleton rows={4} />}>
        <TodayLists dataPromise={dataPromise} role={appUser.role} />
      </Suspense>
    </section>
  );
}

type Action = { href: string; label: string; hint: string; icon: LucideIcon };

function QuickActions({ role }: { role: AppRole }) {
  const actions: Action[] = [];
  if (canCreateSales(role)) {
    actions.push({ href: "/crm/vanzari?nou=1", label: "Vânzare nouă", hint: "Cauți piesa și o vinzi", icon: ShoppingCart });
  }
  if (canWriteCatalog(role)) {
    actions.push(
      { href: "/crm/receptii?nou=1", label: "Primesc marfă", hint: "Recepție de la furnizor", icon: PackagePlus },
      { href: "/crm/inventar?nou=1", label: "Număr stocul", hint: "Inventar pe depozit", icon: ClipboardCheck },
      { href: "/crm/retururi", label: "Retur client", hint: "Din vânzările recente", icon: Undo2 },
    );
  } else {
    if (canViewSection(role, "conturi-plata")) {
      actions.push({ href: "/crm/conturi-plata", label: "Proformă", hint: "Cont de plată pentru firmă", icon: FileText });
    }
    if (canViewSection(role, "la-comanda")) {
      actions.push({ href: "/crm/la-comanda", label: "Comandă la furnizor", hint: "Piesă care nu e în stoc", icon: Truck });
    }
    actions.push({ href: "/crm/produse", label: "Produse", hint: "Catalogul și stocul", icon: PackageSearch });
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map((action, index) => {
        const Icon = action.icon;
        const primary = index === 0;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={`motion-card flex min-h-28 flex-col gap-1 rounded-xl p-4 ${
              primary
                ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                : "border border-[#e4e4e7] bg-white text-[#18181b]"
            }`}
          >
            <span
              className={`mb-2 grid size-9 place-items-center rounded-lg ${
                primary ? "bg-white/15" : "bg-[#eff6ff] text-[#2563eb]"
              }`}
            >
              <Icon className="size-[1.125rem]" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold">{action.label}</span>
            <span className={`text-sm ${primary ? "text-white/85" : "text-[#52525b]"}`}>{action.hint}</span>
          </Link>
        );
      })}
    </div>
  );
}

async function TodayLists({ dataPromise, role }: { dataPromise: Promise<TodayData>; role: AppRole }) {
  const data = await dataPromise;
  const { sales } = data.salesDay;
  const dayLei = sales.reduce((total, sale) => total + documentTotalLei(sale), 0);

  const todo = [
    { show: canViewSection(role, "de-adus"), href: "/crm/de-adus", label: "Piese de adus în 110A", count: data.restockPending, tone: "bg-[#d97706]" },
    { show: canViewSection(role, "vanzari"), href: "/crm/vanzari", label: "Vânzări de azi nebătute la casă", count: data.notRegistered, tone: "bg-[#dc2626]" },
    { show: canViewSection(role, "conturi-plata"), href: "/crm/conturi-plata", label: "Proforme neachitate", count: data.unpaidAccounts, tone: "bg-[#2563eb]" },
    { show: canViewSection(role, "la-comanda"), href: "/crm/la-comanda", label: "Comenzi la furnizori în lucru", count: data.openOrders, tone: "bg-[#0d9488]" },
    { show: canViewSection(role, "aprobari"), href: "/crm/aprobari", label: "Operațiuni de aprobat", count: data.pendingApprovals, tone: "bg-[#7c3aed]" },
  ].filter((item) => item.show);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-3">
        <h2 className="pb-2 text-base font-semibold text-[#18181b]">De făcut</h2>
        <ul>
          {todo.map((item) => (
            <li key={item.href} className="border-t border-[#f4f4f5]">
              <Link
                href={item.href}
                className={`flex items-center gap-3 py-2.5 text-sm hover:text-[#2563eb] ${
                  item.count > 0 ? "text-[#18181b]" : "text-[#71717a]"
                }`}
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${item.count > 0 ? item.tone : "bg-[#d4d4d8]"}`}
                  aria-hidden="true"
                />
                <span className="flex-1">{item.label}</span>
                <span className="font-semibold tabular-nums">{formatNumber(item.count)}</span>
                <ChevronRight className="size-4 text-[#a1a1aa]" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 pb-2">
          <h2 className="text-base font-semibold text-[#18181b]">Vânzările de azi</h2>
          <p className="text-sm text-[#52525b]">
            <span className="font-semibold text-[#18181b]">{formatNumber(sales.length)}</span> ·{" "}
            <span className="font-semibold text-[#18181b]">{formatMoney(dayLei)} lei</span>
          </p>
        </div>
        {sales.length === 0 ? (
          <p className="border-t border-[#f4f4f5] py-6 text-center text-sm text-[#52525b]">
            Nicio vânzare încă azi.
          </p>
        ) : (
          <ul>
            {sales.slice(0, 6).map((sale) => {
              const [first, ...rest] = sale.lines;
              return (
                <li key={sale.id} className="flex items-center gap-3 border-t border-[#f4f4f5] py-2 text-sm">
                  <span className="w-11 shrink-0 tabular-nums text-[#52525b]">{timeFormat.format(sale.createdAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-[#18181b]">
                      {first ? lineDescription(first) : `Vânzare #${sale.number}`}
                      {rest.length > 0 ? <span className="text-[#52525b]"> +{rest.length}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-[#52525b]">
                      {sale.partner?.name ?? "Consumator final"} · {salePaymentMethodLabel(sale.paymentMethod)}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-semibold tabular-nums text-[#18181b]">
                    {formatMoney(documentTotalLei(sale))} lei
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/crm/vanzari" className="mt-1 inline-flex items-center gap-1 border-t border-[#f4f4f5] pt-2 text-sm font-medium text-[#2563eb] hover:underline">
          Toate vânzările <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
