import { headers } from "next/headers";
import type { CatalogLocale } from "@/lib/vitrina/i18n";

export const PUBLIC_LOCALE_HEADER = "x-nadin-public-locale";

export function publicLocaleFromPath(pathname: string): CatalogLocale {
  return pathname === "/ru/catalog" || pathname.startsWith("/ru/catalog/")
    ? "ru"
    : "ro";
}

export function russianCatalogRewritePath(pathname: string) {
  if (pathname === "/ru/catalog") return "/catalog";
  if (pathname.startsWith("/ru/catalog/")) {
    return `/catalog/${pathname.slice("/ru/catalog/".length)}`;
  }
  return pathname;
}

export async function getRequestCatalogLocale(): Promise<CatalogLocale> {
  const requestHeaders = await headers();
  return requestHeaders.get(PUBLIC_LOCALE_HEADER) === "ru" ? "ru" : "ro";
}
