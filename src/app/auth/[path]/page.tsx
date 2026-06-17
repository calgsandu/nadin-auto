import { AuthView } from "@neondatabase/auth/react";
import { LoginForm } from "@/app/auth/login-form";

export const dynamicParams = false;

const CUSTOM_PATHS: Record<string, "sign-in" | "sign-up"> = {
  "sign-in": "sign-in",
  "sign-up": "sign-up",
};

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  const mode = CUSTOM_PATHS[path];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f2ec] px-4 py-10">
      {mode ? (
        <LoginForm mode={mode} />
      ) : (
        // Other Neon Auth flows (forgot/reset password, email verification, callback).
        <div className="w-full max-w-md">
          <AuthView path={path} />
        </div>
      )}
    </main>
  );
}
