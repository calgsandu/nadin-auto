import { AuthCallback } from "@/app/auth/auth-callback";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 py-10">
      <AuthCallback />
    </main>
  );
}
