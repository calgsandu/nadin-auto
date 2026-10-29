import Link from "next/link";
import { TwoFactorShell } from "../two-factor-shell";

export default function TwoFactorErrorPage() {
  return (
    <TwoFactorShell
      title="Autentificarea nu a putut fi finalizată"
      description="Sesiunea nu a putut fi verificată în acest moment. Poți încerca din nou sau poți începe o autentificare nouă."
    >
      <div className="grid gap-3">
        <Link
          href="/auth/2fa/continue"
          className="flex h-11 items-center justify-center rounded-md bg-[#18181b] text-sm font-semibold text-white hover:bg-[#3f3f46]"
        >
          Încearcă din nou
        </Link>
        <Link
          href="/auth/sign-in"
          className="flex h-11 items-center justify-center rounded-md border border-[#e4e4e7] bg-white text-sm font-semibold text-[#52525b] hover:bg-[#f4f4f5]"
        >
          Autentificare nouă
        </Link>
      </div>
    </TwoFactorShell>
  );
}
