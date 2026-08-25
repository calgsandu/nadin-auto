"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Ultimul plasă de siguranță: eroarea a apărut ÎN layoutul rădăcină, deci
 * `error.tsx` nu mai are unde să se randeze. Fișierul înlocuiește layoutul,
 * de aceea își aduce singur `<html>`, `<body>` și foaia de stil, iar textul
 * nu depinde de fonturile încărcate acolo.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ro" className="h-full">
      <body className="min-h-full bg-[#f6f6f4] text-[#1b1a17] antialiased">
        <div className="flex min-h-screen items-center justify-center px-6 py-16">
          <div className="w-full max-w-lg">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Aplicația nu a putut porni
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#57534a]">
              Reîncarcă pagina; dacă se repetă, trimite codul de mai jos.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <button
                className="rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
                type="button"
                onClick={reset}
              >
                Reîncarcă
              </button>
            </div>
            {error.digest ? (
              <p className="mt-8 border-t border-[#e8e7e3] pt-4 text-xs text-[#98948b]">
                Cod: <span className="font-mono">{error.digest}</span>
              </p>
            ) : null}
          </div>
        </div>
      </body>
    </html>
  );
}
