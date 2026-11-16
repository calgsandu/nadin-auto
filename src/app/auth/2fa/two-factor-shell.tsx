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
    <main className="auth-shell flex min-h-screen items-center justify-center bg-[#f3f5fa] px-4 py-10">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#e5e9f0] bg-white shadow-[0_24px_60px_-20px_rgba(24,33,29,0.25)]">
        <header className="border-b border-[#e5e9f0] bg-[#f8fafc] px-6 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#1d4ed8]">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">{title}</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#475569]">{description}</p>
        </header>
        <div className="px-6 py-6 sm:px-8">{children}</div>
        <footer className="border-t border-[#e5e9f0] bg-[#f8fafc] px-6 py-4 sm:px-8">
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm font-semibold text-[#475569] hover:text-[#0f172a]"
            >
              Ieși și folosește alt cont
            </button>
          </form>
        </footer>
      </section>
    </main>
  );
}
