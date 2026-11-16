import { AuthCallback } from "@/app/auth/auth-callback";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <main className="auth-shell flex min-h-screen items-center justify-center bg-[#f3f5fa] px-4 py-10">
      <AuthCallback />
    </main>
  );
}
