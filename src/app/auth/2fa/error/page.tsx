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
          className="flex h-11 items-center justify-center rounded-md bg-[#1b1a17] text-sm font-semibold text-white hover:bg-[#33312c]"
        >
          Încearcă din nou
        </Link>
        <Link
          href="/auth/sign-in"
          className="flex h-11 items-center justify-center rounded-md border border-[#e8e7e3] bg-white text-sm font-semibold text-[#6f6b63] hover:bg-[#f6f6f4]"
        >
          Autentificare nouă
        </Link>
      </div>
    </TwoFactorShell>
  );
}
