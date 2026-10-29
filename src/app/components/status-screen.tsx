import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Ecranul folosit de toate capetele libere: 404, eroare de rută, eroare de
 * layout. Aceeași formă peste tot, ca un 404 din vitrină și o eroare din CRM
 * să nu arate ca două aplicații diferite.
 */
export function StatusScreen({
  title,
  message,
  detail,
  detailLabel = "Cod",
  actions,
}: {
  title: string;
  /** O singură propoziție: ce s-a întâmplat și ce urmează. */
  message: string;
  /** Codul tehnic (digest), pentru când trebuie raportat mai departe. */
  detail?: string;
  detailLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-semibold tracking-tight text-[#18181b] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#52525b]">{message}</p>
        {actions ? <div className="mt-7 flex flex-wrap gap-2.5">{actions}</div> : null}
        {detail ? (
          <p className="mt-8 border-t border-[#e4e4e7] pt-4 text-xs text-[#71717a]">
            {detailLabel}: <span className="font-mono">{detail}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const statusPrimaryButton =
  "button-primary rounded-md bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]";
export const statusSecondaryButton =
  "button-secondary rounded-md border border-[#e4e4e7] bg-white px-4 py-2.5 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]";

export function StatusLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className={statusSecondaryButton} href={href}>
      {label}
    </Link>
  );
}
