import { auth } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";
import {
  PUBLIC_LOCALE_HEADER,
  publicLocaleFromPath,
  russianCatalogRewritePath,
} from "@/lib/vitrina/request-locale";

const authMiddleware = auth.middleware({
  loginUrl: "/auth/sign-in",
});

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicCatalog =
    pathname === "/catalog" ||
    pathname.startsWith("/catalog/") ||
    pathname === "/ru/catalog" ||
    pathname.startsWith("/ru/catalog/");

  if (!isPublicCatalog) {
    // Neon Auth 0.4.1-beta: middleware forwards the raw method+body to the
    // upstream get-session endpoint, so non-GET requests (server actions)
    // always read as unauthenticated and get 307'd to the sign-in page —
    // the client then throws "An unexpected response was received from the
    // server". Run the session check on a GET clone with the same cookies.
    const authRequest =
      request.method === "GET"
        ? request
        : new NextRequest(request.url, {
            method: "GET",
            headers: request.headers,
          });
    return authMiddleware(authRequest);
  }

  const requestHeaders = new Headers(request.headers);
  const locale = publicLocaleFromPath(pathname);
  requestHeaders.set(PUBLIC_LOCALE_HEADER, locale);

  if (locale === "ru") {
    const destination = request.nextUrl.clone();
    destination.pathname = russianCatalogRewritePath(pathname);
    return NextResponse.rewrite(destination, {
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/catalog/:path*",
    "/ru/catalog/:path*",
    "/((?!$|api/auth|auth|catalog|ru/catalog|robots.txt|sitemap.xml|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
