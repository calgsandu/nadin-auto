"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";

/**
 * Panoul lateral folosit de TOATE operațiunile — adăugare și editare deopotrivă.
 * Toate clasele de shell trăiesc aici, ca formularele să nu mai poată devia
 * unul de altul (recepție vs editare vs inventar arătau diferit).
 */
export function OperationDrawer({
  eyebrow,
  title,
  onClose,
  children,
  size = "wide",
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** „wide" = documente cu linii de produse; „narrow" = formulare simple. */
  size?: "wide" | "narrow";
}) {
  const panelRef = useRef<HTMLElement>(null);

  // Operatorul intră direct în căutarea de produs, fără drum cu mouse-ul.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
  }, []);

  return (
    <DrawerPortal>
      <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
        <button
          aria-label={`Închide ${title}`}
          className="absolute inset-0 cursor-default"
          type="button"
          onClick={onClose}
        />
        <aside
          ref={panelRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
          className={`motion-drawer-panel relative flex h-full w-full flex-col overflow-y-auto bg-[#fafaf9] shadow-xl ${
            size === "wide" ? "max-w-7xl" : "max-w-2xl"
          }`}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#6f6b63]">
                {eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">{title}</h2>
            </div>
            <button className={drawerSecondaryButton} type="button" onClick={onClose}>
              Închide
            </button>
          </div>
          {children}
        </aside>
      </div>
    </DrawerPortal>
  );
}

export function DrawerField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#33312c]">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-[#6f6b63]">{hint}</span> : null}
    </label>
  );
}

export function DrawerSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-drawer-lines className="overflow-visible rounded-xl border border-[#e8e7e3] bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-[#e8e7e3] bg-[#f6f6f4] px-4 py-3">
        <div>
          <h3 className="font-semibold text-[#1b1a17]">{title}</h3>
          {description ? <p className="text-xs text-[#6f6b63]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="grid gap-3 p-3">{children}</div>
    </section>
  );
}

export function DrawerFooter({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5">
      <span className="mr-auto text-xs text-[#6f6b63]">
        Enter = câmpul următor · salvarea doar din buton
      </span>
      <button className={drawerSecondaryButton} type="button" onClick={onCancel}>
        Anulează
      </button>
      <DrawerSubmit label={submitLabel} />
    </div>
  );
}

export function DrawerSubmit({ label }: { label: string }) {
  const status = useFormStatus();
  return (
    <button
      className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Se salvează..." : label}
    </button>
  );
}

/** Mesajul de stare al formularului (aceeași formă în toate drawerele). */
export function DrawerMessage({ state }: { state: { ok: boolean; message: string } }) {
  if (!state.message) return null;
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        state.ok
          ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
          : "border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]"
      }`}
    >
      {state.message}
    </div>
  );
}

const FOCUSABLE_FIELDS =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/** Mută focusul pe câmpul următor din același formular. False = era ultimul. */
export function focusNextField(from: HTMLElement) {
  const form = from.closest("form");
  if (!form) return false;
  const fields = Array.from(form.querySelectorAll<HTMLElement>(FOCUSABLE_FIELDS));
  const next = fields[fields.indexOf(from) + 1];
  if (!next) return false;
  next.focus();
  if (next instanceof HTMLInputElement && next.type !== "date") next.select();
  return true;
}

/**
 * Enter NU salvează niciodată operațiunea — salvarea e doar din buton.
 * Enter mută pe câmpul următor; pe ultimul câmp adaugă o linie nouă și sare
 * în căutarea de produs a acesteia.
 */
export function handleEnterNavigation(
  event: React.KeyboardEvent<HTMLFormElement>,
  addLine?: () => void,
) {
  if (event.key !== "Enter" || event.defaultPrevented) return;
  const target = event.target as HTMLElement;
  // Textarea păstrează Enter pentru rânduri noi; butoanele își fac treaba lor.
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) return;

  const form = event.currentTarget;
  event.preventDefault();

  // Pe ultimul câmp al ultimei linii, Enter deschide o linie nouă — nu sare
  // peste rândurile de produs în notițe.
  const lines = target.closest("[data-drawer-lines]");
  const lineFields = lines
    ? Array.from(lines.querySelectorAll<HTMLElement>(FOCUSABLE_FIELDS))
    : [];
  const onLastLineField = lineFields.length > 0 && lineFields.at(-1) === target;

  if (!onLastLineField && focusNextField(target)) return;
  if (!addLine) {
    focusNextField(target);
    return;
  }

  addLine();
  requestAnimationFrame(() => {
    const searches = form.querySelectorAll<HTMLInputElement>('input[role="combobox"]');
    searches[searches.length - 1]?.focus();
  });
}

export const drawerFormClassName = "grid gap-6 px-6 py-6";
export const drawerInputClassName =
  "field-control h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm outline-none placeholder:text-[#98948b]";
export const drawerSecondaryButton =
  "button-secondary flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#fafaf9]";
export const drawerDangerButton =
  "button-danger mt-6 grid size-11 place-items-center rounded-md border border-[#e8e7e3] bg-white text-[#991b1b] hover:border-[#dc2626] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-35";
export const drawerLineClassName =
  "motion-line-item grid gap-3 rounded-md border border-[#efeeeb] bg-white p-3 md:items-start";
