"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

/**
 * OAuth landing page. Neon Auth redirects here with `?neon_auth_session_verifier`.
 * This route is NOT behind the auth middleware, so it always renders — letting the
 * client exchange the verifier with a same-site request (which carries the
 * `__Secure-neon-auth.session_challange` cookie that a cross-site redirect to a
 * protected route would drop). Once the session is established we enter the
 * application-level second-factor dispatcher.
 */
export function AuthCallback() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      // Calling getSession with the verifier still in the URL triggers the
      // exchange inside the SDK; retry briefly until the session materialises.
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const result = await authClient.getSession();
          const session = (result as { data?: unknown })?.data ?? result;
          if (session && typeof session === "object" && "user" in session) {
            if (!cancelled) window.location.assign("/auth/2fa/continue");
            return;
          }
        } catch {
          // ignore and retry
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      if (!cancelled) setFailed(true);
    }

    complete();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {failed ? (
        <>
          <p className="text-sm text-[#b91c1c]">Autentificarea nu s-a finalizat.</p>
          <Link
            href="/auth/sign-in"
            className="text-sm font-semibold text-[#18181b] underline decoration-[#2563eb] underline-offset-4"
          >
            Înapoi la autentificare
          </Link>
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="size-8 animate-spin rounded-full border-2 border-[#e4e4e7] border-t-[#2563eb]"
          />
          <p className="text-sm text-[#52525b]">Te conectăm...</p>
        </>
      )}
    </div>
  );
}
