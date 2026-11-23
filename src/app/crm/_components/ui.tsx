import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Filter, X, type LucideIcon } from "lucide-react";
import { vehicleLabel, type VehicleFitmentInfo } from "@/lib/catalog/vehicle-label";
import { productLineSubtitle, type ProductLineInfo } from "@/lib/catalog/product-line-label";

export const adminRowCls =
  "motion-table-row border-t border-[#eeede9] align-top hover:bg-[#faf9f7]";

/**
 * Coloanele secundare dispar sub `lg`. Tabelele CRM-ului aveau `min-w-[1100px]`,
 * deci pe telefon rămâneau doar cu scroll orizontal; ascunderea coloanelor
 * accesorii le face citibile fără a schimba structura tabelului.
 */
const secondaryCls = "hidden lg:table-cell";

export function TableHead({
  align = "left",
  secondary = false,
  children,
  className = "",
}: {
  align?: "left" | "right";
  secondary?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-2 text-[0.8125rem] font-medium text-[#78716c] ${
        align === "right" ? "text-right" : "text-left"
      } ${secondary ? secondaryCls : ""} ${className}`}
    >
      {children}
    </th>
  );
}

export function TableCell({
  align = "left",
  secondary = false,
  children,
  className = "",
}: {
  align?: "left" | "right";
  secondary?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-2 ${align === "right" ? "text-right" : "text-left"} ${
        secondary ? secondaryCls : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/** Subtitlul unei linii de produs: „MARCĂ MODEL ani · tip". */
export function VehicleSubline({
  fitment,
  product,
}: {
  fitment?: VehicleFitmentInfo | null;
  product?: ProductLineInfo | null;
}) {
  const label = product ? productLineSubtitle(product) : vehicleLabel(fitment);
  return label ? (
    <span className="block text-xs font-normal text-[#57534e]">{label}</span>
  ) : null;
}

export function DailyMetric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Iconița din colț: cifrele se recunosc dintr-o privire, fără să citești eticheta. */
  icon?: LucideIcon;
}) {
  return (
    <div className="min-w-0 bg-white px-5 py-4 max-sm:px-3 max-sm:py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#78716c] max-sm:truncate max-sm:text-xs">{label}</p>
        {Icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#ecebe6] text-[#1a1917] max-sm:hidden">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[1.75rem] font-medium leading-tight tracking-tight tabular-nums text-[#1a1917] max-sm:mt-0.5 max-sm:text-lg">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[#78716c] max-sm:hidden">{hint}</p> : null}
    </div>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}

export function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      title={label}
      className="button-secondary inline-flex items-center gap-2 rounded-full border border-[#e6e4df] bg-white px-3.5 py-2 text-sm font-medium text-[#1a1917] hover:bg-[#faf9f7]"
    >
      <Download className="size-4" aria-hidden="true" />
      <span className="max-sm:sr-only">{label}</span>
    </a>
  );
}

/** Tabelul standard al secțiunilor de nomenclator (branduri, modele, tipuri…). */
export function AdminSection({
  head,
  children,
  empty,
  isEmpty,
  minWidth = "640px",
}: {
  head: (string | null)[];
  children: ReactNode;
  empty: string;
  isEmpty: boolean;
  minWidth?: string;
}) {
  return (
    <section className="motion-page p-4 lg:px-6 lg:py-5">
      <div className="overflow-hidden crm-card">
        <div className="overflow-x-auto">
          <table
            className="crm-table w-full border-collapse text-left text-sm"
            style={{ minWidth }}
          >
            <thead className="border-b border-[#e6e4df] bg-[#faf9f7]">
              <tr>
                {head.map((h, i) =>
                  h === null ? null : (
                    <TableHead
                      key={i}
                      align={i === head.length - 1 && h === "Acțiuni" ? "right" : "left"}
                    >
                      {h}
                    </TableHead>
                  ),
                )}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
        {isEmpty ? (
          <div className="px-4 py-14 text-center text-sm text-[#78716c]">{empty}</div>
        ) : null}
      </div>
    </section>
  );
}

export function ButtonSkeleton() {
  return (
    <div aria-hidden="true" className="skeleton-pulse h-9 w-32 rounded-md bg-[#eeede9]" />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#e6e4df] bg-white px-3.5 py-2.5">
      <div className="skeleton-pulse h-3.5 w-24 rounded bg-[#eeede9]" />
      <div className="skeleton-pulse mt-2 h-6 w-16 rounded bg-[#f0efeb]" />
    </div>
  );
}

/** Scheletul folosit de `loading.tsx` al fiecărei secțiuni. */
export function WorkspaceSkeleton({
  cards = 0,
  filters = 0,
  rows = 5,
}: {
  cards?: number;
  filters?: number;
  rows?: number;
}) {
  return (
    <section
      aria-label="Se încarcă datele"
      aria-live="polite"
      className="grid gap-4 p-4 lg:px-6 lg:py-5"
    >
      {cards > 0 ? (
        <div className="stat-strip grid grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : null}

      {filters > 0 ? (
        <div className="grid gap-3 rounded-lg border border-[#e6e4df] bg-[#faf9f7] p-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: filters }, (_, index) => (
            <div key={index} className="skeleton-pulse h-10 rounded-md bg-[#eeede9]" />
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden crm-card">
        <div className="h-9 border-b border-[#e6e4df] bg-[#faf9f7]" />
        <div className="grid gap-2 p-3">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="skeleton-pulse h-9 rounded-md bg-[#f0efeb]" />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Paginile afișate: prima, ultima și vecinii paginii curente, cu „…" între ele. */
export function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  for (const n of sorted) {
    const previous = result.at(-1);
    if (typeof previous === "number" && n - previous > 1) result.push("gap");
    result.push(n);
  }
  return result;
}

/** Paginare numerotată: « ‹ 1 2 3 … 25 › », cu poziția curentă în stânga. */
export function Pagination({
  page,
  pageCount,
  hrefFor,
  summary,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  summary?: ReactNode;
}) {
  if (pageCount <= 1) return summary ? <p className="text-sm text-[#57534e]">{summary}</p> : null;
  const cell =
    "grid h-8 min-w-8 place-items-center rounded-full border px-2 text-sm font-medium tabular-nums";
  const idle = `${cell} border-[#e6e4df] bg-white text-[#44403c] hover:bg-[#f3f2ef]`;
  const disabled = `${cell} border-[#eeede9] text-[#d6d3d1]`;
  const step = (target: number, label: string, icon: ReactNode) =>
    target < 1 || target > pageCount || target === page ? (
      <span aria-hidden="true" className={disabled}>{icon}</span>
    ) : (
      <Link aria-label={label} className={idle} href={hrefFor(target)}>
        {icon}
      </Link>
    );

  return (
    <nav aria-label="Paginare" className="flex flex-wrap items-center gap-1.5 text-sm">
      {summary ? <p className="mr-auto text-[#57534e]">{summary}</p> : null}
      {step(1, "Prima pagină", <ChevronsLeft className="size-4" aria-hidden="true" />)}
      {step(page - 1, "Pagina anterioară", <ChevronLeft className="size-4" aria-hidden="true" />)}
      {pageWindow(page, pageCount).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-[#a8a29e]">…</span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={`${cell} border-[#1a1917] bg-[#1a1917] text-white`}>
            {item}
          </span>
        ) : (
          <Link key={item} className={idle} href={hrefFor(item)}>
            {item}
          </Link>
        ),
      )}
      {step(page + 1, "Pagina următoare", <ChevronRight className="size-4" aria-hidden="true" />)}
      {step(pageCount, "Ultima pagină", <ChevronsRight className="size-4" aria-hidden="true" />)}
    </nav>
  );
}

/*
 * Bara de filtre a paginilor (același aspect ca filtrele de la Produse): fiecare
 * filtru e o „pastilă" cu iconiță, eticheta e pentru cititoarele de ecran, iar
 * pastila se colorează când filtrul e activ. Merge în formulare GET simple.
 */
export const filterControlCls =
  "min-w-0 cursor-pointer bg-transparent font-medium text-inherit outline-none [color-scheme:light]";

export function FilterField({
  icon,
  label,
  active = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`field-control inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm ${
        active ? "border-[#d6d3cd] bg-[#ecebe6] text-[#34322e]" : "border-[#e6e4df] bg-white text-[#44403c]"
      }`}
    >
      <span className="shrink-0 opacity-70 [&>svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}

export function FilterSubmit({ label = "Aplică" }: { label?: string }) {
  return (
    <button
      type="submit"
      className="button-secondary inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e6e4df] bg-white px-3 text-sm font-medium text-[#1a1917] hover:bg-[#f3f2ef]"
    >
      <Filter className="size-4 text-[#78716c]" aria-hidden="true" />
      {label}
    </button>
  );
}

export function FilterReset({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[#57534e] hover:bg-[#f3f2ef] hover:text-[#1a1917]"
    >
      <X className="size-4" aria-hidden="true" /> Resetează
    </Link>
  );
}

/** Comutator segmentat (depozite, filtre de listă): un grup, nu pastile separate. */
// Pe telefon un singur rând care se derulează, nu trei rânduri de depozite.
export const segmentedCls =
  "inline-flex max-w-full flex-wrap gap-0.5 rounded-full border border-[#e6e4df] bg-white p-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] [&>*]:shrink-0 [&>*]:whitespace-nowrap";

export function segmentCls(active: boolean) {
  return `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
    active ? "bg-[#1a1917] text-white" : "text-[#57534e] hover:bg-[#f3f2ef] hover:text-[#1a1917]"
  }`;
}

/** Numărul din interiorul unei pastile de filtru („Deschise 4"). */
export function SegmentCount({ active, value }: { active: boolean; value: number }) {
  return (
    <span
      className={`ml-1 inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
        active ? "bg-white text-[#1a1917]" : "bg-[#ecebe6] text-[#1a1917]"
      }`}
    >
      {value}
    </span>
  );
}

export type BadgeTone = "blue" | "green" | "amber" | "red" | "gray" | "purple";

const badgeTones: Record<BadgeTone, string> = {
  blue: "bg-[#e3eaf8] text-[#2f4f8f]",
  green: "bg-[#dff1e4] text-[#1f6b3a]",
  amber: "bg-[#fbefc9] text-[#7a5300]",
  red: "bg-[#fde4de] text-[#a8321d]",
  gray: "bg-[#ecebe6] text-[#44403c]",
  purple: "bg-[#ece6fa] text-[#5b3fa0]",
};

/** Insigna de status din tabele (aceeași formă peste tot: În stoc, Activ, Creare…). */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium [&>svg]:size-3.5 ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Culorile pastel ale segmentelor și cardurilor colorate (stil „Keel"). */
export type PastelTone = "red" | "yellow" | "blue" | "lilac" | "green" | "gray";

const barTones: Record<PastelTone, string> = {
  red: "bg-[#f2a08f]",
  yellow: "bg-[#f3d37a]",
  blue: "bg-[#a9bde6]",
  lilac: "bg-[#c7b8ef]",
  green: "bg-[#a8d8b4]",
  gray: "bg-[#78716c]",
};

const cardTones: Record<PastelTone, string> = {
  red: "bg-[#fbe3dc]",
  yellow: "bg-[#faefcc]",
  blue: "bg-[#dfe6f6]",
  lilac: "bg-[#e9e3f9]",
  green: "bg-[#dcefe1]",
  gray: "bg-white",
};

const statCols: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };

export type HeroSegment = { label: string; value: string; amount: number; tone: PastelTone; note?: ReactNode };
export type HeroStat = { label: string; value: string; hint?: ReactNode; icon?: LucideIcon; tone?: PastelTone };

/**
 * Blocul negru din capul paginii: cifra principală, din ce e compusă (bara
 * segmentată) și câteva cifre de lângă ea. Unul singur pe pagină.
 */
export function HeroPanel({
  label,
  value,
  note,
  corner,
  segments = [],
  stats = [],
}: {
  label: string;
  value: string;
  note?: ReactNode;
  /** Ceva mic în colțul din dreapta-sus (o pastilă albă, un link). */
  corner?: ReactNode;
  segments?: HeroSegment[];
  stats?: HeroStat[];
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(segment.amount, 0), 0);
  return (
    <section className="motion-page rounded-[1.25rem] bg-[#1a1917] p-5 text-white lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[#a8a29e]">{label}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[2.25rem] font-normal leading-none tracking-tight tabular-nums lg:text-[2.75rem]">{value}</span>
            {note ? <span className="text-sm text-[#a8a29e]">{note}</span> : null}
          </p>
        </div>
        {corner}
      </div>

      {segments.length > 0 && total > 0 ? (
        <div className="mt-6 grid gap-3" style={{ gridTemplateColumns: segments.map((s) => `minmax(0, ${Math.max(s.amount, total * 0.08)}fr)`).join(" ") }}>
          {segments.map((segment) => (
            <div key={segment.label} className="min-w-0">
              <div className={`h-1.5 rounded-full ${barTones[segment.tone]}`} />
              <p className="mt-2 truncate text-sm">
                <span className="text-[#a8a29e]">{segment.label}</span>{" "}
                <span className="font-medium tabular-nums">{segment.value}</span>
              </p>
              {segment.note ? <p className="mt-0.5 truncate text-xs text-[#a8a29e]">{segment.note}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {stats.length > 0 ? (
        <div className={`crm-hero-rule grid grid-cols-2 gap-4 border-t pt-5 ${statCols[Math.min(stats.length, 4)]} ${segments.length > 0 ? "mt-6" : "mt-5"}`}>
          {stats.map(({ label: statLabel, value: statValue, hint, icon: Icon, tone = "gray" }) => (
            <div key={statLabel} className="flex min-w-0 items-start gap-3">
              {Icon ? (
                <span className={`grid size-9 shrink-0 place-items-center rounded-full text-[#1a1917] max-sm:hidden ${tone === "gray" ? "bg-white" : cardTones[tone]}`}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-xs text-[#a8a29e]">{statLabel}</p>
                <p className="text-lg font-medium leading-tight tabular-nums">{statValue}</p>
                {hint ? <p className="mt-0.5 truncate text-xs text-[#a8a29e] max-sm:hidden">{hint}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Card colorat pastel cu o cifră și o bară de progres (depozite, mărci, ținte). */
export function PastelCard({
  tone,
  title,
  subtitle,
  value,
  of,
  progress,
  footer,
  icon: Icon,
}: {
  tone: PastelTone;
  title: string;
  subtitle?: ReactNode;
  value: string;
  of?: string;
  /** 0–1; lipsă = fără bară. */
  progress?: number;
  footer?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className={`motion-card min-w-0 rounded-[1.25rem] p-4 lg:p-5 ${cardTones[tone]}`}>
      <div className="flex items-center gap-3">
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#1a1917]">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#1a1917]">{title}</p>
          {subtitle ? <p className="truncate text-xs text-[#57534e]">{subtitle}</p> : null}
        </div>
      </div>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-[1.75rem] font-normal leading-none tracking-tight tabular-nums text-[#1a1917]">{value}</span>
        {of ? <span className="text-sm text-[#57534e]">{of}</span> : null}
      </p>
      {progress !== undefined ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80">
          <div className="h-full rounded-full bg-[#1a1917]" style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }} />
        </div>
      ) : null}
      {footer ? <div className="mt-3 text-xs text-[#57534e]">{footer}</div> : null}
    </div>
  );
}
