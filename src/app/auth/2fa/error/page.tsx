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
          className="flex h-11 items-center justify-center rounded-md bg-(--c-accent) text-sm font-semibold text-white hover:bg-(--c-accent-hover)"
        >
          Încearcă din nou
        </Link>
        <Link
          href="/auth/sign-in"
          className="flex h-11 items-center justify-center rounded-md border border-(--c-line) bg-(--c-surface) text-sm font-semibold text-(--c-muted) hover:bg-(--c-hover)"
        >
          Autentificare nouă
        </Link>
      </div>
    </TwoFactorShell>
  );
}
