import { AuthView } from "@neondatabase/auth/react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/auth/login-form";

export const dynamicParams = false;

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  if (path === "sign-up") redirect("/auth/sign-in");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 py-10">
      {path === "sign-in" ? (
        <LoginForm />
      ) : (
        // Other Neon Auth flows (forgot/reset password, email verification, callback).
        <div className="w-full max-w-md">
          <AuthView path={path} />
        </div>
      )}
    </main>
  );
}
