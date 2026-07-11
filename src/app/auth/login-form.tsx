"use client";

import { useActionState, useState, type FormEvent } from "react";
import { authenticateWithUsername } from "@/app/auth/actions";
import {
  getUsernameValidationMessage,
  initialAuthFormState,
} from "@/app/auth/form-state";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    authenticateWithUsername,
    initialAuthFormState,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const error = validationError ?? state.error;

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

  return (
    <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white shadow-[0_24px_60px_-20px_rgba(24,33,29,0.35)] md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#1b1a17] p-10 text-white md:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#d97706]/20 blur-2xl"
        />
        <div className="relative">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-[#d97706]">
            Depozit · Produse auto
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight">
            Nadin Auto
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#a8a49b]">
            Catalog, stoc și operațiuni de depozit într-un singur loc.
          </p>
        </div>
        <ul className="relative space-y-3 text-sm text-[#d6d3cd]">
          {["Catalog cu 1.900+ produse", "Recepții, vânzări și transferuri", "Acces controlat pentru personal"].map(
            (item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="size-1.5 shrink-0 rounded-full bg-[#d97706]" />
                {item}
              </li>
            ),
          )}
        </ul>
      </aside>

      <section className="bg-[#fafaf9] p-8 sm:p-10">
        <div className="md:hidden">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#92400e]">
            Nadin Auto
          </p>
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">Bine ai revenit</h2>
        <p className="mt-1 text-sm text-[#6f6b63]">
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
            <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="mt-1 h-11 rounded-md bg-[#1b1a17] text-sm font-semibold text-white transition-colors hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Se autentifică..." : "Autentificare"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#33312c]">
      {label}
      {children}
    </label>
  );
}

const inputClassName =
  "h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm text-[#1b1a17] outline-none transition focus:border-[#d97706] focus:ring-2 focus:ring-[#d97706]/30 placeholder:text-[#98948b]";
