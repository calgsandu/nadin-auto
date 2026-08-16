"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";
import type { DrawerDraftBanner } from "@/app/components/use-drawer-draft";

/**
 * Panoul lateral folosit de TOATE operațiunile — adăugare și editare deopotrivă.
 * Toate clasele de shell trăiesc aici, ca formularele să nu mai poată devia
 * unul de altul (recepție vs editare vs inventar arătau diferit).
 *
 * Închiderea NU șterge ciorna: panoul rămâne montat, doar ascuns, deci la
 * redeschidere operatorul găsește tot ce apucase să completeze. Refreshul,
 * crashul de tab și navigarea prin sidebar sunt acoperite de ciorna din
 * localStorage (`useDrawerDraft`). Se golește doar la salvarea reușită.
 */
export function OperationDrawer({
  title,
  onClose,
  children,
  size = "wide",
  open = true,
  submitLabel,
  pending,
  draft,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** „wide" = documente cu linii de produse; „narrow" = formulare simple. */
  size?: "wide" | "narrow";
  /** false = ciornă păstrată în DOM, panoul doar ascuns. */
  open?: boolean;
  /** Dat = buton de salvare în antetul lipit sus (documentele lungi n-au nevoie de scroll). */
  submitLabel?: string;
  pending?: boolean;
  /** Starea ciornei locale — vezi `useDrawerDraft`. */
  draft?: DrawerDraftBanner;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);

  // Operatorul intră direct în căutarea de produs, fără drum cu mouse-ul.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
  }, [open]);

  // Ciorna nesalvată nu se pierde nici la refresh/închidere de tab fără avertisment.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return (
    <DrawerPortal locked={open}>
      <div
        className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30"
        style={open ? undefined : { display: "none" }}
        onInput={() => {
          dirtyRef.current = true;
        }}
        // form.reset() la salvare reușită curăță și avertismentul.
        onReset={() => {
          dirtyRef.current = false;
        }}
      >
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
              <h2 className="text-2xl font-semibold text-[#1b1a17]">{title}</h2>
              {draft?.savedAt ? (
                <p className="mt-1 text-sm text-[#6f6b63]">
                  Ciornă salvată {draftTime(draft.savedAt)}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {submitLabel ? (
                // requestSubmit() = aceeași validare + același onSubmit ca butonul din josul formularului.
                <button
                  className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={pending}
                  type="button"
                  onClick={() => panelRef.current?.querySelector("form")?.requestSubmit()}
                >
                  {pending ? "Se salvează..." : submitLabel}
                </button>
              ) : null}
              <button className={drawerSecondaryButton} type="button" onClick={onClose}>
                Închide
              </button>
            </div>
          </div>
          <DraftBanner draft={draft} />
          {children}
        </aside>
      </div>
    </DrawerPortal>
  );
}

export function draftTime(savedAt: number) {
  return new Date(savedAt).toLocaleTimeString("ro-MD", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Banda de sus: ciorna recuperată după refresh/crash, cu ieșire din ea. */
export function DraftBanner({ draft }: { draft?: DrawerDraftBanner }) {
  if (!draft?.restoredAt) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#fde68a] bg-[#fffbeb] px-6 py-2.5 text-sm text-[#92400e]">
      <span>Ciornă recuperată de la {draftTime(draft.restoredAt)}</span>
      <button
        className="font-semibold underline underline-offset-2 hover:no-underline"
        type="button"
        onClick={draft.onDiscard}
      >
        Renunță la ciornă
      </button>
    </div>
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

const OFFLINE_MESSAGE =
  "Fără conexiune. Ciorna e salvată local — reîncearcă după ce revine internetul.";
const NO_ANSWER_MESSAGE =
  "Serverul n-a răspuns. Ciorna e salvată — apasă Reîncearcă.";

/**
 * Trimite acțiunea FĂRĂ resetul automat pe care React îl face la `<form action>`:
 * dacă salvarea eșuează, tot ce era completat rămâne pe ecran. Formularul se
 * golește explicit doar la succes.
 *
 * Rețeaua căzută și funcția expirată nu mai aruncă în afară: devin o stare cu
 * buton „Reîncearcă", care retrimite ACELAȘI `FormData` (deci același
 * `idempotencyKey`) — serverul nu poate scrie documentul de două ori.
 */
export function useDrawerAction<S extends { ok: boolean; message: string }>(
  action: (previous: S, formData: FormData) => S | Promise<S>,
  initial: S,
  onSuccess?: () => void,
) {
  const [failure, setFailure] = useState<string | null>(null);
  // Acțiunea se poate reconstrui la fiecare randare (return-dialog o face);
  // trimiterea trebuie s-o folosească pe cea curentă.
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });

  const guarded = useCallback(async (previous: S, formData: FormData) => {
    try {
      const next = await actionRef.current(previous, formData);
      setFailure(null);
      return next;
    } catch {
      // Aici ajunge doar ce nu s-a putut duce până la capăt (rețea căzută,
      // funcție expirată): acțiunile își prind singure erorile de business.
      setFailure(NO_ANSWER_MESSAGE);
      return previous;
    }
  }, []);

  // Cast: S e mereu un obiect simplu de stare, deci Awaited<S> = S (TS nu o poate deduce).
  const [state, dispatch] = useActionState(
    guarded as unknown as (previous: Awaited<S>, formData: FormData) => Promise<Awaited<S>>,
    initial as Awaited<S>,
  );
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const lastFormData = useRef<FormData | null>(null);
  // Identitatea stării, nu `ok`: două salvări reușite la rând sunt două
  // răspunsuri distincte, deci și a doua trebuie să golească formularul și
  // ciorna (altfel al treilea document ar pleca cu un token deja folosit).
  const seenState = useRef(state);

  useEffect(() => {
    if (state !== seenState.current && state.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
    seenState.current = state;
  }, [state, onSuccess]);

  function send(formData: FormData) {
    lastFormData.current = formData;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setFailure(OFFLINE_MESSAGE);
      return;
    }
    setFailure(null);
    startTransition(() => dispatch(formData));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    formRef.current = form;
    send(new FormData(form));
  }

  function retry() {
    if (lastFormData.current) send(lastFormData.current);
  }

  return {
    // Eșecul de transport bate ultimul răspuns al serverului până la reîncercare.
    state: (failure ? { ...state, ok: false, message: failure } : state) as S,
    pending,
    onSubmit,
    /** Dat = trimiterea n-a ajuns la server; retrimite același FormData. */
    retry: failure ? retry : undefined,
  };
}

export function DrawerFooter({
  onCancel,
  submitLabel,
  pending,
}: {
  onCancel: () => void;
  submitLabel: string;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5">
      <span className="mr-auto text-xs text-[#6f6b63]">
        Enter trece la câmpul următor. Salvarea doar din buton.
      </span>
      <button className={drawerSecondaryButton} type="button" onClick={onCancel}>
        Anulează
      </button>
      <DrawerSubmit label={submitLabel} pending={pending} />
    </div>
  );
}

export function DrawerSubmit({ label, pending }: { label: string; pending?: boolean }) {
  // useFormStatus nu vede trimiterile manuale (useDrawerAction) — de aceea `pending`.
  const status = useFormStatus();
  const busy = pending ?? status.pending;
  return (
    <button
      className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={busy}
      type="submit"
    >
      {busy ? "Se salvează..." : label}
    </button>
  );
}

/** Mesajul de stare al formularului (aceeași formă în toate drawerele). */
export function DrawerMessage({
  state,
  onRetry,
}: {
  state: { ok: boolean; message: string };
  /** Dat de `useDrawerAction` când trimiterea n-a ajuns la server. */
  onRetry?: () => void;
}) {
  if (!state.message) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm ${
        state.ok
          ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
          : "border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]"
      }`}
    >
      {state.message}
      {onRetry ? (
        <button
          className="rounded-md border border-[#b91c1c] px-2.5 py-1 text-xs font-semibold hover:bg-[#fee2e2]"
          type="button"
          onClick={onRetry}
        >
          Reîncearcă
        </button>
      ) : null}
    </div>
  );
}

// `data-enter-skip` = câmp auxiliar (filtru, bifă de etichetă): Enter sare peste el.
const FOCUSABLE_FIELDS =
  'input:not([type="hidden"]):not([disabled]):not([data-enter-skip]), select:not([disabled]):not([data-enter-skip]), textarea:not([disabled]):not([data-enter-skip])';

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
 * Focus pe căutarea primului rând de produs — rândul nou intră mereu sus, deci
 * după „Adaugă produs" operatorul scrie direct, fără drum cu mouse-ul.
 */
export function focusFirstLineSearch() {
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLInputElement>('[data-drawer-lines] input[role="combobox"]')
      ?.focus();
  });
}

/**
 * Enter NU salvează niciodată operațiunea — salvarea e doar din buton.
 * Enter mută pe câmpul următor; pe ultimul câmp al rândului în lucru adaugă o
 * linie nouă și sare în căutarea de produs a acesteia.
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

  // Rândurile noi intră în capul listei, deci cel în lucru e primul: pe ultimul
  // lui câmp Enter deschide un rând nou, în loc să coboare în cele completate.
  const lines = target.closest("[data-drawer-lines]");
  const line = target.closest(`.${DRAWER_LINE_MARKER}`);
  const onLastFieldOfCurrentLine =
    !!line &&
    Array.from(line.querySelectorAll<HTMLElement>(FOCUSABLE_FIELDS)).at(-1) === target;
  const onFirstLine = !!lines && lines.querySelector(`.${DRAWER_LINE_MARKER}`) === line;

  if (!(onLastFieldOfCurrentLine && onFirstLine) && focusNextField(target)) return;
  if (!addLine) {
    focusNextField(target);
    return;
  }

  addLine();
  requestAnimationFrame(() => {
    form.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
  });
}

export const drawerFormClassName = "grid gap-6 px-6 py-6";
export const drawerInputClassName =
  "field-control h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm outline-none placeholder:text-[#98948b]";
export const drawerSecondaryButton =
  "button-secondary flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#fafaf9]";
export const drawerDangerButton =
  "button-danger mt-6 grid size-11 place-items-center rounded-md border border-[#e8e7e3] bg-white text-[#991b1b] hover:border-[#dc2626] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-35";
/** Marchează un rând de produs, ca navigarea cu Enter să știe unde se află. */
const DRAWER_LINE_MARKER = "motion-line-item";
export const drawerLineClassName =
  `${DRAWER_LINE_MARKER} grid gap-3 rounded-md border border-[#efeeeb] bg-white p-3 md:items-start`;
