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
      className="text-sm font-medium text-(--c-muted) transition-colors hover:text-(--c-ink)"
      aria-label={locale === "ru" ? "Переключить на румынский" : "Schimbă în limba rusă"}
    >
      {locale === "ru" ? "RO" : "RU"}
    </a>
  );
}
