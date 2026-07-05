import type { Metadata } from "next";
import Link from "next/link";
import { Outfit } from "next/font/google";
import { COMPANY } from "@/lib/company";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Nadin Auto — Catalog piese de caroserie",
  description:
    "Catalog public Nadin Auto: piese de caroserie pentru 30 de mărci auto — praguri, aripi, panouri, faruri și multe altele.",
};

export default function VitrinaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${outfit.variable} min-h-screen bg-[#0b0a08] text-[#f4f1ea] [font-family:var(--font-outfit),sans-serif] selection:bg-[#d97706] selection:text-[#0b0a08]`}
    >
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
        <nav className="flex w-full max-w-3xl items-center justify-between gap-2 rounded-full border border-white/10 bg-[#0b0a08]/70 py-2 pl-3 pr-2 backdrop-blur-xl">
          <Link href="/catalog" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-[#d97706] text-sm font-bold text-[#0b0a08]">
              N
            </span>
            <span className="text-sm font-semibold tracking-[0.18em]">
              NADIN AUTO
            </span>
          </Link>
          <div className="hidden items-center gap-1 text-sm text-[#b5afa4] sm:flex">
            <Link
              href="/catalog#marci"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-[#f4f1ea]"
            >
              Mărci
            </Link>
            <Link
              href="/catalog#categorii"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-[#f4f1ea]"
            >
              Categorii
            </Link>
          </div>
          <Link
            href="/catalog/cauta"
            className="rounded-full bg-[#f4f1ea] px-4 py-2 text-sm font-semibold text-[#0b0a08] transition-colors hover:bg-white"
          >
            Caută o piesă
          </Link>
        </nav>
      </header>

      <main className="w-full max-w-full overflow-x-hidden">{children}</main>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Nu găsești piesa?{" "}
            <span className="text-[#d97706]">Întreabă-ne direct.</span>
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/catalog/cauta"
              className="rounded-full bg-[#d97706] px-6 py-3 text-sm font-semibold text-[#0b0a08] transition-colors hover:bg-[#f59e0b]"
            >
              Caută în catalog
            </Link>
            <Link
              href="/auth/sign-in"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-[#f4f1ea] transition-colors hover:bg-white/5"
            >
              Acces angajați
            </Link>
          </div>
          <div className="mt-16 flex flex-col gap-2 border-t border-white/10 pt-8 text-sm text-[#8f887c] md:flex-row md:items-center md:justify-between">
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
