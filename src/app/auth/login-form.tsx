"use client";

import { useActionState, useState, type FormEvent } from "react";
import { authenticateWithUsername } from "@/app/auth/actions";
import {
  getSocialRedirectUrl,
  getUsernameValidationMessage,
  initialAuthFormState,
} from "@/app/auth/form-state";
import { authClient } from "@/lib/auth/client";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    authenticateWithUsername,
    initialAuthFormState,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const error = validationError ?? googleError ?? state.error;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setValidationError(null);
    const formData = new FormData(event.currentTarget);
    const message = getUsernameValidationMessage(
      String(formData.get("username") ?? ""),
      String(formData.get("password") ?? ""),
    );
    if (message) {
      event.preventDefault();
      setValidationError(message);
    }
  }

  async function handleGoogle() {
    setValidationError(null);
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/auth/callback",
      });
      const redirectUrl = getSocialRedirectUrl(result);
      if (redirectUrl) {
        window.location.assign(redirectUrl);
        return;
      }
      setGoogleError("Google nu a returnat linkul de autentificare.");
    } catch {
      setGoogleError("Autentificarea Google nu a putut fi pornită.");
    }
    setGoogleLoading(false);
  }

  return (
    <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-(--c-line) bg-(--c-surface) shadow-[0_24px_60px_-20px_rgba(24,33,29,0.35)] md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-(--c-accent) p-10 text-white md:flex">
        <div>
          <span className="grid size-12 place-items-center rounded-2xl bg-(--c-surface)">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-7 w-9 object-contain" />
          </span>
          <h1 className="mt-8 text-4xl font-semibold leading-tight tracking-tight">Nadin Auto</h1>
          <p className="mt-3 max-w-xs text-[0.9375rem] leading-relaxed text-white/75">
            Catalog, stoc și vânzări într-un singur loc.
          </p>
        </div>
      </aside>

      <section className="bg-(--c-surface) p-8 sm:p-10">
        <p className="text-base font-bold text-(--c-ink) md:hidden">Nadin Auto</p>
        <h2 className="mt-4 text-2xl font-semibold text-(--c-ink) md:mt-0">Bine ai revenit</h2>
        <p className="mt-1 text-sm text-(--c-muted)">
          Autentifică-te cu datele primite de la administrator.
        </p>

        <form action={formAction} onSubmit={handleSubmit} noValidate className="mt-7 grid gap-4">
          <Field label="Nume de utilizator">
            <input
              className={inputClassName}
              name="username"
              autoComplete="username"
              required
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ex. ion"
            />
          </Field>
          <Field label="Parolă">
            <input
              className={inputClassName}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </Field>
          {error ? (
            <div className="rounded-md border border-(--c-red-line) bg-(--c-red-soft) px-3 py-2 text-sm text-(--c-red)">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="mt-1 h-11 rounded-md bg-(--c-accent) text-sm font-semibold text-white transition-colors hover:bg-(--c-accent-hover) disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Se autentifică..." : "Autentificare"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-(--c-muted-2)">
          <span className="h-px flex-1 bg-(--c-line)" />
          cont existent
          <span className="h-px flex-1 bg-(--c-line)" />
        </div>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-(--c-line) bg-(--c-surface) text-sm font-semibold text-(--c-ink) transition-colors hover:bg-(--c-hover) disabled:opacity-60"
        >
          <GoogleIcon />
          {googleLoading ? "Se conectează..." : "Google — doar conturi existente"}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-(--c-muted-2)">
          Google nu acordă acces conturilor noi; panoul acceptă numai personalul aprobat.
        </p>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-(--c-ink-2)">
      {label}
      {children}
    </label>
  );
}

const inputClassName =
  "h-11 w-full rounded-md border border-(--c-line) bg-(--c-surface) px-3 text-sm text-(--c-ink) outline-none transition focus:border-(--c-accent) focus:ring-2 focus:ring-(--c-accent)/30 placeholder:text-(--c-muted-2)";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.06 12.25c0-.85-.07-1.47-.22-2.12H12.24v3.85h6.2c-.13 1.04-.8 2.6-2.3 3.65l-.02.14 3.34 2.58.23.02c2.13-1.97 3.36-4.86 3.36-8.12z" />
      <path fill="#34A853" d="M12.24 24c3.04 0 5.59-1 7.45-2.73l-3.55-2.74c-.95.66-2.22 1.12-3.9 1.12-2.98 0-5.5-1.96-6.4-4.67l-.13.01-3.47 2.68-.05.13C3.93 21.3 7.8 24 12.24 24z" />
      <path fill="#FBBC05" d="M5.84 14.98a7.4 7.4 0 0 1-.4-2.98c0-1.04.18-2.05.39-2.98l-.01-.2-3.51-2.72-.12.05A11.97 11.97 0 0 0 .24 12c0 1.93.46 3.76 1.27 5.38l4.33-2.4z" />
      <path fill="#EB4335" d="M12.24 4.75c2.11 0 3.54.91 4.35 1.67l3.17-3.1C17.82 1.46 15.28.25 12.24.25 7.8.25 3.93 2.95 1.51 6.62l4.32 2.4c.91-2.71 3.43-4.27 6.41-4.27z" />
    </svg>
  );
}
