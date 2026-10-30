import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Filter, Info, X } from "lucide-react";
import { vehicleLabel, type VehicleFitmentInfo } from "@/lib/catalog/vehicle-label";
import { productLineSubtitle, type ProductLineInfo } from "@/lib/catalog/product-line-label";

export const adminRowCls =
  "motion-table-row border-t border-[#f0f0f2] align-top hover:bg-[#fafafa]";

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
      className={`whitespace-nowrap px-3 py-2 text-xs font-medium text-[#52525b] ${
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
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${
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
    <span className="block text-xs font-normal text-[#52525b]">{label}</span>
  ) : null;
}

export function DailyMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#e4e4e7] bg-white px-4 py-3">
      <p className="text-[13px] font-medium text-[#52525b]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[#18181b]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[#71717a]">{hint}</p> : null}
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
      className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
    >
      <Download className="size-4" aria-hidden="true" />
      {label}
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
      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="overflow-x-auto">
          <table
            className="crm-table w-full border-collapse text-left text-sm"
            style={{ minWidth }}
          >
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
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
          <div className="px-4 py-12 text-center text-sm text-[#52525b]">{empty}</div>
        ) : null}
      </div>
    </section>
  );
}

export function ButtonSkeleton() {
  return (
    <div aria-hidden="true" className="skeleton-pulse h-9 w-32 rounded-md bg-[#f0f0f2]" />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2.5">
      <div className="skeleton-pulse h-3.5 w-24 rounded bg-[#f0f0f2]" />
      <div className="skeleton-pulse mt-2 h-6 w-16 rounded bg-[#f1f1f3]" />
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
        <div className="grid gap-3 rounded-lg border border-[#e4e4e7] bg-[#fafafa] p-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: filters }, (_, index) => (
            <div key={index} className="skeleton-pulse h-10 rounded-md bg-[#f0f0f2]" />
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="h-9 border-b border-[#e4e4e7] bg-[#fafafa]" />
        <div className="grid gap-2 p-3">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="skeleton-pulse h-9 rounded-md bg-[#f1f1f3]" />
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
  if (pageCount <= 1) return summary ? <p className="text-sm text-[#52525b]">{summary}</p> : null;
  const cell =
    "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-sm font-medium tabular-nums";
  const idle = `${cell} border-[#e4e4e7] bg-white text-[#3f3f46] hover:bg-[#f4f4f5]`;
  const disabled = `${cell} border-[#f0f0f2] text-[#d4d4d8]`;
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
      {summary ? <p className="mr-auto text-[#52525b]">{summary}</p> : null}
      {step(1, "Prima pagină", <ChevronsLeft className="size-4" aria-hidden="true" />)}
      {step(page - 1, "Pagina anterioară", <ChevronLeft className="size-4" aria-hidden="true" />)}
      {pageWindow(page, pageCount).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-[#a1a1aa]">…</span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={`${cell} border-[#18181b] bg-[#18181b] text-white`}>
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
        active ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]" : "border-[#e4e4e7] bg-white text-[#3f3f46]"
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
      className="button-secondary inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]"
    >
      <Filter className="size-4 text-[#71717a]" aria-hidden="true" />
      {label}
    </button>
  );
}

export function FilterReset({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b]"
    >
      <X className="size-4" aria-hidden="true" /> Resetează
    </Link>
  );
}

/** Comutator segmentat (depozite, filtre de listă): un grup, nu pastile separate. */
export const segmentedCls = "inline-flex max-w-full flex-wrap rounded-lg border border-[#e4e4e7] bg-white p-0.5";

export function segmentCls(active: boolean) {
  return `rounded-md px-3 py-1 text-sm font-medium transition-colors ${
    active ? "bg-[#18181b] text-white" : "text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b]"
  }`;
}

export type BadgeTone = "blue" | "green" | "amber" | "red" | "gray" | "purple";

const badgeTones: Record<BadgeTone, string> = {
  blue: "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]",
  green: "bg-[#f0fdf4] text-[#166534] ring-[#bbf7d0]",
  amber: "bg-[#fffbeb] text-[#92400e] ring-[#fde68a]",
  red: "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]",
  gray: "bg-[#f4f4f5] text-[#3f3f46] ring-[#e4e4e7]",
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

/**
 * Nota scurtă de deasupra unui tabel („cum funcționează secțiunea") cu acțiunea
 * principală la dreapta — un rând de bară de instrumente, nu o cutie separată.
 */
export function PageNote({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex min-w-0 items-start gap-2 text-sm text-[#52525b]">
        <Info className="mt-0.5 size-4 shrink-0 text-[#71717a]" aria-hidden="true" />
        <span>
          <span className="font-medium text-[#18181b]">{title}.</span> {children}
        </span>
      </p>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}
