import type { Metadata } from "next";
import Script from "next/script";
import { Manrope, Roboto_Mono } from "next/font/google";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";
import "./globals.css";

const appFont = Manrope({
  variable: "--font-app",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

// Self-hostat: stickerele folosesc mono, iar un mono de sistem are alte lățimi
// de caracter pe fiecare OS/browser → text tăiat altfel la print.
const monoFont = Roboto_Mono({
  variable: "--font-app-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "Nadin Auto",
  description: "Catalog intern Nadin Auto",
  // Cardul pentru WhatsApp/Facebook/Telegram; imaginea vine din
  // `opengraph-image.tsx`, iar iconițele din icon.png / apple-icon.png.
  openGraph: {
    type: "website",
    siteName: "Nadin Auto",
    locale: "ro_MD",
    alternateLocale: ["ru_MD"],
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestCatalogLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${appFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f6f6f4] text-[#1b1a17]">
        <Script id="crm-sidebar-state" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("nadin-crm-collapsed")==="1")document.documentElement.setAttribute("data-crm-collapsed","")}catch(e){}`}
        </Script>
        <NeonAuthUIProvider authClient={authClient} redirectTo="/">
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
