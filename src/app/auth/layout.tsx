import type { Metadata } from "next";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Providerul stă aici, nu în layoutul rădăcină: singurul lui consumator e
 * `AuthView` din `/auth/[path]`. Montat global, aducea pe FIECARE pagină încă
 * un `<Toaster />` al vendorului — iar sonner are o singură coadă, deci orice
 * notificare a aplicației ieșea de două ori, o dată în colțul lui.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/">
      {children}
    </NeonAuthUIProvider>
  );
}
