import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel } from "@/lib/finance/months";

const navButton =
  "button-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[#e4e4e7] bg-white text-[#18181b] hover:bg-[#f4f4f5]";

function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Navigare pe luni, ca `SalesDayNav` pe zile: înapoi, luna afișată, înainte.
 * Doar linkuri — douăsprezece pastile cu luni umpleau două rânduri de ecran.
 */
export function MonthNav({ month, hrefFor }: { month: string; hrefFor: (month: string) => string }) {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isCurrent = month >= current;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link className={navButton} href={hrefFor(shiftMonth(month, -1))} aria-label="Luna precedentă">
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>
      <span className="min-w-36 text-center text-sm font-semibold capitalize text-[#18181b]">
        {monthLabel(month)}
      </span>
      {isCurrent ? (
        <span className={`${navButton} cursor-not-allowed opacity-40`} aria-hidden="true">
          <ChevronRight className="size-4" />
        </span>
      ) : (
        <Link className={navButton} href={hrefFor(shiftMonth(month, 1))} aria-label="Luna următoare">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}
      {!isCurrent ? (
        <Link
          className="button-secondary h-9 content-center rounded-md border border-[#e4e4e7] bg-white px-3 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
          href={hrefFor(current)}
        >
          Luna curentă
        </Link>
      ) : null}
    </div>
  );
}
