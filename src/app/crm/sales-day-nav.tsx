"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDay(key: string, delta: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return toKey(date);
}

const dayHref = (key: string) => `/crm?section=vanzari&day=${key}`;

const navButton =
  "button-secondary inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-[#e8e7e3] bg-white text-[#1b1a17] hover:bg-[#f6f6f4]";

/** Navigare pe zile pentru Vânzări: chevron înapoi/înainte + selector de dată. */
export function SalesDayNav({ dayKey }: { dayKey: string }) {
  const router = useRouter();
  const todayKey = toKey(new Date());
  const isToday = dayKey >= todayKey;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link className={navButton} href={dayHref(shiftDay(dayKey, -1))} aria-label="Ziua precedentă">
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>
      <input
        type="date"
        value={dayKey}
        max={todayKey}
        onChange={(event) => {
          if (event.target.value) router.push(dayHref(event.target.value));
        }}
        className="h-10 rounded-md border border-[#e8e7e3] bg-white px-2.5 text-sm font-medium text-[#1b1a17]"
        aria-label="Alege ziua"
      />
      {isToday ? (
        <span className={`${navButton} cursor-not-allowed opacity-40`} aria-hidden="true">
          <ChevronRight className="size-4" />
        </span>
      ) : (
        <Link className={navButton} href={dayHref(shiftDay(dayKey, 1))} aria-label="Ziua următoare">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}
      {!isToday ? (
        <Link
          className="button-secondary h-10 content-center rounded-md border border-[#e8e7e3] bg-white px-3 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
          href={dayHref(todayKey)}
        >
          Azi
        </Link>
      ) : null}
    </div>
  );
}
