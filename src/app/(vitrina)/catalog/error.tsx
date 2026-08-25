"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  StatusLink,
  StatusScreen,
  statusPrimaryButton,
} from "@/app/components/status-screen";
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";

/**
 * Eroarea vitrinei are pagina ei, altfel vizitatorul cădea pe boundary-ul
 * rădăcină: text intern, în română, cu un buton spre „/" care duce un
 * cumpărător drept în ecranul de autentificare.
 *
 * Limba se citește din cale, nu din antetul cererii: componenta e client.
 */
export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const locale = pathname.startsWith("/ru/") || pathname === "/ru" ? "ru" : "ro";
  const copy = catalogCopy(locale);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="pt-24">
      <StatusScreen
        title={copy.error.title}
        message={copy.error.message}
        detail={error.digest}
        detailLabel={copy.error.code}
        actions={
          <>
            <button className={statusPrimaryButton} type="button" onClick={reset}>
              {copy.error.retry}
            </button>
            <StatusLink href={catalogHref(locale)} label={copy.notFound.home} />
          </>
        }
      />
    </div>
  );
}
