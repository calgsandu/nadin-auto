import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Filter, X, type LucideIcon } from "lucide-react";
import { vehicleLabel, type VehicleFitmentInfo } from "@/lib/catalog/vehicle-label";
import { productLineSubtitle, type ProductLineInfo } from "@/lib/catalog/product-line-label";

export const adminRowCls =
  "motion-table-row border-t border-[#edf0f5] align-top hover:bg-[#f8fafc]";

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
      className={`whitespace-nowrap px-4 py-2 text-[0.8125rem] font-medium text-[#64748b] ${
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
    <span className="block text-xs font-normal text-[#475569]">{label}</span>
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
        <p className="text-sm text-[#64748b] max-sm:truncate max-sm:text-xs">{label}</p>
        {Icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eef4ff] text-[#2563eb] max-sm:hidden">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[1.75rem] font-medium leading-tight tracking-tight tabular-nums text-[#0f172a] max-sm:mt-0.5 max-sm:text-lg">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[#64748b] max-sm:hidden">{hint}</p> : null}
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
      className="button-secondary inline-flex items-center gap-2 rounded-lg border border-[#e5e9f0] bg-white px-3 py-2 text-sm font-medium text-[#0f172a] hover:bg-[#f8fafc]"
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
            <thead className="border-b border-[#e5e9f0] bg-[#f8fafc]">
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
          <div className="px-4 py-14 text-center text-sm text-[#64748b]">{empty}</div>
        ) : null}
      </div>
    </section>
  );
}

export function ButtonSkeleton() {
  return (
    <div aria-hidden="true" className="skeleton-pulse h-9 w-32 rounded-md bg-[#edf0f5]" />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#e5e9f0] bg-white px-3.5 py-2.5">
      <div className="skeleton-pulse h-3.5 w-24 rounded bg-[#edf0f5]" />
      <div className="skeleton-pulse mt-2 h-6 w-16 rounded bg-[#eef1f6]" />
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
        <div className="grid gap-3 rounded-lg border border-[#e5e9f0] bg-[#f8fafc] p-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: filters }, (_, index) => (
            <div key={index} className="skeleton-pulse h-10 rounded-md bg-[#edf0f5]" />
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden crm-card">
        <div className="h-9 border-b border-[#e5e9f0] bg-[#f8fafc]" />
        <div className="grid gap-2 p-3">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="skeleton-pulse h-9 rounded-md bg-[#eef1f6]" />
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
  if (pageCount <= 1) return summary ? <p className="text-sm text-[#475569]">{summary}</p> : null;
  const cell =
    "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-sm font-medium tabular-nums";
  const idle = `${cell} border-[#e5e9f0] bg-white text-[#334155] hover:bg-[#f1f4f9]`;
  const disabled = `${cell} border-[#edf0f5] text-[#cbd5e1]`;
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
      {summary ? <p className="mr-auto text-[#475569]">{summary}</p> : null}
      {step(1, "Prima pagină", <ChevronsLeft className="size-4" aria-hidden="true" />)}
      {step(page - 1, "Pagina anterioară", <ChevronLeft className="size-4" aria-hidden="true" />)}
      {pageWindow(page, pageCount).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-[#94a3b8]">…</span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={`${cell} border-[#2563eb] bg-[#2563eb] text-white`}>
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
      className={`field-control inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm ${
        active ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]" : "border-[#e5e9f0] bg-white text-[#334155]"
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
      className="button-secondary inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e5e9f0] bg-white px-3 text-sm font-medium text-[#0f172a] hover:bg-[#f1f4f9]"
    >
      <Filter className="size-4 text-[#64748b]" aria-hidden="true" />
      {label}
    </button>
  );
}

export function FilterReset({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[#475569] hover:bg-[#f1f4f9] hover:text-[#0f172a]"
    >
      <X className="size-4" aria-hidden="true" /> Resetează
    </Link>
  );
}

/** Comutator segmentat (depozite, filtre de listă): un grup, nu pastile separate. */
// Pe telefon un singur rând care se derulează, nu trei rânduri de depozite.
export const segmentedCls =
  "inline-flex max-w-full flex-wrap rounded-lg border border-[#e5e9f0] bg-white p-0.5 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] [&>*]:shrink-0 [&>*]:whitespace-nowrap";

export function segmentCls(active: boolean) {
  return `rounded-md px-3 py-1 text-sm font-medium transition-colors ${
    active ? "bg-[#2563eb] text-white" : "text-[#475569] hover:bg-[#f1f4f9] hover:text-[#0f172a]"
  }`;
}

export type BadgeTone = "blue" | "green" | "amber" | "red" | "gray" | "purple";

const badgeTones: Record<BadgeTone, string> = {
  blue: "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]",
  green: "bg-[#f0fdf4] text-[#166534] ring-[#bbf7d0]",
  amber: "bg-[#fffbeb] text-[#92400e] ring-[#fde68a]",
  red: "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]",
  gray: "bg-[#f1f4f9] text-[#334155] ring-[#e5e9f0]",
  purple: "bg-[#f5f3ff] text-[#6d28d9] ring-[#ddd6fe]",
};

/** Insigna de status din tabele (aceeași formă peste tot: În stoc, Activ, Creare…). */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}
