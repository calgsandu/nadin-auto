import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: "Nadin Auto",
  description: "Catalog intern Nadin Auto",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f6f6f4] text-[#1b1a17]">
        <NeonAuthUIProvider authClient={authClient} redirectTo="/">
          {children}
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
