import { ShieldCheck } from "lucide-react";
import { logoutAction } from "@/app/auth/actions";

export function TwoFactorShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white shadow-[0_24px_60px_-20px_rgba(24,33,29,0.25)]">
        <header className="border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#175cd3]">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#175cd3]">
                Nadin Auto · Securitate
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1b1a17]">{title}</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#6f6b63]">{description}</p>
        </header>
        <div className="px-6 py-6 sm:px-8">{children}</div>
        <footer className="border-t border-[#e8e7e3] bg-[#fafaf9] px-6 py-4 sm:px-8">
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm font-semibold text-[#6f6b63] hover:text-[#1b1a17]"
            >
              Ieși și folosește alt cont
            </button>
          </form>
        </footer>
      </section>
    </main>
  );
}
