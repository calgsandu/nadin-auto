import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { COMPANY } from "@/lib/company";
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";
import { LanguageSwitcher } from "./language-switcher";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestCatalogLocale();
  const copy = catalogCopy(locale).metadata;
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: catalogHref(locale),
      languages: { ro: catalogHref("ro"), ru: catalogHref("ru") },
    },
  };
}

export default async function VitrinaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestCatalogLocale();
  const copy = catalogCopy(locale);
  return (
    <div
      lang={locale}
      // Același font și aceeași paletă ca CRM-ul (Outfit n-are chirilice: rusa cade pe Manrope).
      style={{ fontFamily: "var(--font-crm), var(--font-app), ui-sans-serif, system-ui, sans-serif" }}
      className="min-h-screen bg-(--c-bg) text-(--c-ink) selection:bg-(--c-accent) selection:text-white"
    >
      <header className="fixed inset-x-0 top-0 z-50 border-b border-(--c-line) bg-(--c-bg)/95 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={catalogHref(locale)} className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Nadin Auto"
              width={48}
              height={32}
              className="h-7 w-10 shrink-0 object-contain sm:h-8 sm:w-12"
            />
            <span className="whitespace-nowrap text-base font-medium">Nadin Auto</span>
          </Link>
          <div className="hidden items-center gap-6 text-[15px] text-(--c-muted) sm:flex">
            <Link
              href={catalogHref(locale, "#marci")}
              className="transition-colors hover:text-(--c-ink)"
            >
              {copy.nav.brands}
            </Link>
            <Link
              href={catalogHref(locale, "#categorii")}
              className="transition-colors hover:text-(--c-ink)"
            >
              {copy.nav.categories}
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Suspense fallback={null}>
              <LanguageSwitcher locale={locale} />
            </Suspense>
            <Link
              href={catalogHref(locale, "/cauta")}
              className="whitespace-nowrap rounded-full bg-(--c-accent) px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-(--c-accent-hover)"
            >
              {copy.nav.search}
            </Link>
          </div>
        </nav>
      </header>

      <main className="w-full max-w-full overflow-x-hidden">{children}</main>

      <footer className="border-t border-(--c-line)">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <p className="max-w-2xl text-2xl font-medium tracking-tight md:text-[2rem] md:leading-tight">
            {copy.footer.question} {copy.footer.answer}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href={catalogHref(locale, "/cauta")}
              className="rounded-full bg-(--c-accent) px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-(--c-accent-hover)"
            >
              {copy.footer.search}
            </Link>
          </div>
          <div className="mt-16 flex flex-col gap-2 border-t border-(--c-line) pt-8 text-sm text-(--c-muted) md:flex-row md:items-center md:justify-between">
            <p>
              © {new Date().getFullYear()} {COMPANY.legalName}
            </p>
            <p>{COMPANY.address}</p>
            {/* Creditul studioului. Sta doar in layout-ul catalogului, deci nu apare
                in CRM sau pe fluxul de autentificare. */}
            <a
              href="https://tasta.dev"
              className="group inline-flex items-center gap-1.5 transition-colors hover:text-(--c-ink)"
            >
              <span>Aplicație de</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 100 100"
                aria-hidden="true"
                className="transition-transform duration-150 group-hover:translate-y-[2px]"
              >
                <mask id="tasta-keycap" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                  <rect x="2" y="2" width="96" height="96" rx="18" fill="#fff" />
                  <rect x="20" y="20" width="60" height="60" rx="10" stroke="#000" strokeWidth="5" fill="none" />
                  <path d="M36 34 H64 V42 H54 V66 H46 V42 H36 Z" fill="#000" />
                </mask>
                <rect x="2" y="2" width="96" height="96" rx="18" fill="currentColor" mask="url(#tasta-keycap)" />
              </svg>
              <span className="border-b border-current pb-px font-semibold">Tasta</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
