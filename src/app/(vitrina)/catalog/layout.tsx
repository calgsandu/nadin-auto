import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Manrope } from "next/font/google";
import { Suspense } from "react";
import { COMPANY } from "@/lib/company";
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";
import { LanguageSwitcher } from "./language-switcher";

const manrope = Manrope({
  variable: "--font-catalog",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

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
      className={`${manrope.variable} min-h-screen bg-[#f6f6f4] text-[#1b1a17] selection:bg-[#2e90fa] selection:text-white`}
      style={{ fontFamily: "var(--font-catalog), sans-serif" }}
    >
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
        <nav className="flex w-full max-w-3xl items-center justify-between gap-2 rounded-full border border-black/10 bg-white/70 py-2 pl-3 pr-2 backdrop-blur-xl">
          <Link href={catalogHref(locale)} className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Nadin Auto"
              width={48}
              height={32}
              className="h-8 w-12 object-contain"
            />
            <span className="text-sm font-semibold tracking-[0.18em]">
              NADIN AUTO
            </span>
          </Link>
          <div className="hidden items-center gap-1 text-sm text-[#57534a] sm:flex">
            <Link
              href={catalogHref(locale, "#marci")}
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-black/5 hover:text-[#1b1a17]"
            >
              {copy.nav.brands}
            </Link>
            <Link
              href={catalogHref(locale, "#categorii")}
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-black/5 hover:text-[#1b1a17]"
            >
              {copy.nav.categories}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <LanguageSwitcher locale={locale} />
            </Suspense>
            <Link
              href={catalogHref(locale, "/cauta")}
              className="rounded-full bg-[#1b1a17] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              {copy.nav.search}
            </Link>
          </div>
        </nav>
      </header>

      <main className="w-full max-w-full overflow-x-hidden">{children}</main>

      <footer className="border-t border-black/10">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            {copy.footer.question}{" "}
            <span className="text-[#2e90fa]">{copy.footer.answer}</span>
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={catalogHref(locale, "/cauta")}
              className="rounded-full bg-[#2e90fa] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1b7fe8]"
            >
              {copy.footer.search}
            </Link>
          </div>
          <div className="mt-16 flex flex-col gap-2 border-t border-black/10 pt-8 text-sm text-[#6f6a61] md:flex-row md:items-center md:justify-between">
            <p>
              © {new Date().getFullYear()} {COMPANY.legalName}
            </p>
            <p>{COMPANY.address}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
