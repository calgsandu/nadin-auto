import Link from "next/link";
import type { ReactNode } from "react";
import { Download } from "lucide-react";
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
    <div className="motion-card rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2.5">
      <p className="text-xs font-medium text-[#52525b]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums text-[#18181b]">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[#71717a]">{hint}</p> : null}
    </div>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}

export function PagerLink({
  href,
  label,
  disabled,
}: {
  href: string;
  label: string;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-[#e4e4e7] px-3 py-1.5 font-medium text-[#a1a1aa]">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="button-secondary rounded-md border border-[#e4e4e7] bg-white px-3 py-1.5 font-medium text-[#18181b] hover:bg-[#f4f4f5]"
    >
      {label}
    </Link>
  );
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
    <section className="motion-page p-4">
      <div className="motion-card overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
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
      className="grid gap-3 p-4"
    >
      {cards > 0 ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
