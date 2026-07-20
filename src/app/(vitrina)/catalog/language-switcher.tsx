"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  switchCatalogLocale,
  type CatalogLocale,
} from "@/lib/vitrina/i18n";

export function LanguageSwitcher({ locale }: { locale: CatalogLocale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.size ? `?${searchParams.toString()}` : "";
  const targetLocale = locale === "ru" ? "ro" : "ru";

  return (
    <a
      href={switchCatalogLocale(pathname, search, targetLocale)}
      hrefLang={targetLocale}
      className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-xs font-bold tracking-wide text-[#57534a] transition-colors hover:border-[#2e90fa]/50 hover:text-[#1b1a17]"
      aria-label={locale === "ru" ? "Переключить на румынский" : "Schimbă în limba rusă"}
    >
      {locale === "ru" ? "RO" : "RU"}
    </a>
  );
}
