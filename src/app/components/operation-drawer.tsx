"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react";
import { useFormStatus } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { CloseIconButton, SaveButton } from "@/app/components/icon-buttons";
import { useActionToast } from "@/app/components/action-toast";
import type { DrawerDraftBanner } from "@/app/components/use-drawer-draft";

/**
 * Formularele mici (partener, încasare, brand, parolă) se deschid ca modal
 * centrat, nu ca panou pe tot ecranul. În modal, `DrawerCard` devine secțiune
 * plată cu iconița și titlul în stânga — același stil ca fișa de produs.
 */
const DrawerModalContext = createContext(false);

export function DrawerModalScope({ children }: { children: ReactNode }) {
  return <DrawerModalContext.Provider value>{children}</DrawerModalContext.Provider>;
}

export type ModalWidth = "sm" | "md" | "lg";
const MODAL_WIDTH: Record<ModalWidth, string> = {
  sm: "sm:max-w-xl",
  md: "sm:max-w-3xl",
  lg: "sm:max-w-5xl",
};

export const modalBackdropClassName =
  "motion-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/60 sm:p-6";

/** Pe telefon ecran întreg; de la `sm` în sus, cutie centrată cu scroll propriu. */
export function modalPanelClassName(width: ModalWidth = "md") {
  return `drawer-modal motion-modal-panel relative flex h-full w-full flex-col overflow-y-auto bg-(--c-surface) sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:border sm:border-(--c-line) sm:shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] ${MODAL_WIDTH[width]}`;
}

/** Antetul lipit sus: titlu în stânga, salvare/închidere în dreapta. */
export function modalHeaderClassName(modal: boolean) {
  return `sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-(--c-line) px-4 py-2.5 sm:px-5 sm:py-3 ${
    modal ? "bg-(--c-surface)" : "bg-(--c-surface-2)"
  }`;
}

/**
 * Modalul stă PESTE ce era deschis (vânzarea din care creezi un client), deci
 * focusul trebuie mutat în el: rămas în spate, Esc ar închide documentul.
 */
export function useModalFocus(ref: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      root
        .querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, ref]);
}

export const modalSectionGridClassName = "grid gap-2.5 px-4 py-4 sm:gap-3 sm:px-5 sm:py-5 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-6";
/** Rândul unei secțiuni de modal (titlu în stânga, câmpuri în dreapta), și pentru `<summary>`. */
export const modalSectionClassName = `${modalSectionGridClassName} border-b border-(--c-line) last:border-b-0`;

/**
 * O parte a unui modal: iconița + titlul într-o coloană în stânga, câmpurile
 * în dreapta. `hint` = rezumatul viu (marja, totalul, câte mașini).
 */
export function ModalSection({
  icon,
  title,
  hint,
  action,
  lines = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  lines?: boolean;
  children: ReactNode;
}) {
  return (
    <section data-modal-section data-drawer-lines={lines ? "" : undefined} className={modalSectionClassName}>
      <div>
        <ModalSectionTitle icon={icon} title={title} hint={hint} />
        {action ? <div className="mt-2 lg:ml-[2.625rem]">{action}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function ModalSectionTitle({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--c-accent-soft) text-(--c-accent)">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      {/* Pe telefon rezumatul stă pe același rând cu titlul: un rând mai puțin. */}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 lg:block">
        <h3 className="py-1.5 font-semibold leading-5 text-(--c-ink)">{title}</h3>
        {hint ? <p className="text-sm tabular-nums text-(--c-muted-2) lg:-mt-1">{hint}</p> : null}
      </div>
    </div>
  );
}

/**
 * Granița dintre un dialog-copil și părintele lui.
 *
 * Portalul mută nodurile în `body`, dar evenimentele React urcă prin arborele
 * de COMPONENTE, nu prin DOM: fără asta, submitul copilului ar trimite și
 * formularul părinte, Enter-ul ar naviga în el, iar tastarea în copil l-ar
 * marca „murdar". Se pune pe rădăcina portalului, deci handlerele proprii ale
 * copilului (care sunt mai adânc) apucă să ruleze primele.
 */
export const drawerBoundaryProps = {
  onKeyDown: (event: React.SyntheticEvent) => event.stopPropagation(),
  onSubmit: (event: React.SyntheticEvent) => event.stopPropagation(),
  onInput: (event: React.SyntheticEvent) => event.stopPropagation(),
} as const;

/**
 * Butoanele din pagina Azi duc la `/crm/vanzari?nou=1` (și la fel pentru
 * recepție/inventar): dialogul se deschide singur o dată, iar `nou` dispare din
 * adresă, ca un refresh sau „Înapoi" să nu-l redeschidă. Restul parametrilor
 * (ex. `produs` la „Vinde") ajung la dialog.
 */
export function useOpenFromUrl(enabled: boolean | undefined, open: (params: URLSearchParams) => void) {
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  useEffect(() => {
    if (!enabled) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("nou") !== "1") return;
    const params = new URLSearchParams(url.searchParams);
    url.searchParams.delete("nou");
    url.searchParams.delete("produs");
    window.history.replaceState(window.history.state, "", url);
    openRef.current(params);
  }, [enabled]);
}

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
  icon: Icon,
  onClose,
  children,
  open = true,
  submitLabel,
  pending,
  draft,
  modal,
}: {
  title: string;
  /** Iconița operațiunii, lângă titlu (aceeași ca pe butonul care o deschide). */
  icon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  /** false = ciornă păstrată în DOM, panoul doar ascuns. */
  open?: boolean;
  /** Dat = buton de salvare în antetul lipit sus (documentele lungi n-au nevoie de scroll). */
  submitLabel?: string;
  pending?: boolean;
  /** Starea ciornei locale — vezi `useDrawerDraft`. */
  draft?: DrawerDraftBanner;
  /** Dat = formular mic, deschis ca modal centrat de lățimea asta. */
  modal?: ModalWidth;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);
  // Dialogurile-copil (client nou, produs nou) sunt modale PESTE panou, deci
  // panoul rămâne vizibil în spate cât sunt deschise.
  const visible = open;

  // Operatorul intră direct în căutarea de produs, fără drum cu mouse-ul.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus();
  }, [open]);
  useModalFocus(panelRef, open && Boolean(modal));

  // Ciorna nesalvată nu se pierde nici la refresh/închidere de tab fără avertisment.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return (
    <DrawerPortal locked={visible}>
      <div
        className={modal ? modalBackdropClassName : "motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30"}
        style={visible ? undefined : { display: "none" }}
        {...drawerBoundaryProps}
        onInput={(event) => {
          dirtyRef.current = true;
          drawerBoundaryProps.onInput(event);
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
            // Ctrl+Enter (sau Ctrl+S) salvează din orice câmp, fără drum la buton.
            if ((event.ctrlKey || event.metaKey) && (event.key === "Enter" || event.key.toLowerCase() === "s")) {
              event.preventDefault();
              event.stopPropagation();
              if (!pending) panelRef.current?.querySelector("form")?.requestSubmit();
              return;
            }
            if (event.key !== "Escape") return;
            // Escape tratat aici nu mai are ce căuta mai sus: dacă panoul e un
            // dialog-copil, ar închide și părintele în aceeași apăsare.
            event.stopPropagation();
            onClose();
          }}
          // Câmpurile cu cifre: un click selectează tot (scrii direct peste „1"),
          // iar rotița mouse-ului nu mai schimbă cantitatea pe furiș la derulare.
          onFocus={(event) => {
            const target = event.target;
            if (target instanceof HTMLInputElement && target.type === "number") {
              requestAnimationFrame(() => target.select());
            }
          }}
          onWheel={(event) => {
            const target = event.target;
            if (target instanceof HTMLInputElement && target.type === "number" && target === document.activeElement) {
              target.blur();
            }
          }}
          className={modal ? modalPanelClassName(modal) : drawerPanelClassName}
        >
          <div className={modalHeaderClassName(Boolean(modal))}>
            <div>
              <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-(--c-ink)">
                {Icon ? (
                  <span className="grid size-8 place-items-center rounded-lg bg-(--c-accent) text-white">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                ) : null}
                {title}
              </h2>
              {draft?.savedAt ? (
                <p className="text-xs text-(--c-muted)">
                  Ciornă salvată {draftTime(draft.savedAt)}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {submitLabel ? (
                // requestSubmit() = aceeași validare + același onSubmit ca butonul din josul formularului.
                <SaveButton
                  label={submitLabel}
                  pending={pending}
                  onClick={() => panelRef.current?.querySelector("form")?.requestSubmit()}
                />
              ) : null}
              <CloseIconButton onClick={onClose} />
            </div>
          </div>
          <DraftBanner draft={draft} />
          <DrawerModalContext.Provider value={Boolean(modal)}>{children}</DrawerModalContext.Provider>
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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-(--c-amber-line) bg-(--c-amber-soft) px-5 py-2 text-sm text-(--c-amber)">
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

/**
 * O alegere dintr-un rând de butoane (Da/Nu, Cash/Card…): un click, fără listă
 * derulantă. Niciun buton nu e bifat din start — cu `required`, formularul nu
 * pleacă până nu alege omul explicit. Radioul acoperă butonul (transparent),
 * deci și mesajul de validare al browserului apare lângă buton.
 */
export function DrawerChoice({
  label,
  hint,
  name,
  options,
  required = false,
}: {
  label: string;
  /** Se vede doar cât timp nu e nimic ales. */
  hint?: string;
  name: string;
  options: { value: string; label: string; icon?: LucideIcon }[];
  required?: boolean;
}) {
  return (
    <fieldset className="group min-w-0">
      <legend className="mb-1 text-sm font-medium text-(--c-ink-2)">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              className="peer absolute inset-0 size-full cursor-pointer opacity-0"
              name={name}
              required={required}
              type="radio"
              value={option.value}
            />
            <span className="flex h-9 items-center gap-1.5 rounded-md border border-(--c-line) bg-(--c-surface) px-3 text-sm font-medium text-(--c-ink-2) transition-colors peer-hover:border-(--c-line-strong) peer-checked:border-(--c-accent) peer-checked:bg-(--c-accent-soft) peer-checked:text-(--c-accent-strong) peer-focus-visible:ring-2 peer-focus-visible:ring-(--c-accent)/40">
              {option.icon ? <option.icon className="size-4 opacity-70" aria-hidden="true" /> : null}
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {hint ? (
        <span className="mt-1 block text-xs text-(--c-muted-2) group-has-[:checked]:hidden">{hint}</span>
      ) : null}
    </fieldset>
  );
}

export function DrawerField({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    // Eticheta mai stinsă decât valoarea: ochiul cade pe ce e scris, nu pe titluri.
    <label className={`grid gap-1 text-[13px] font-medium text-(--c-muted) ${className}`}>
      <span className="line-label">{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-(--c-muted)">{hint}</span> : null}
    </label>
  );
}

/** Titlul unei părți din formular: iconiță în pătrățel + nume, acțiunea la dreapta. */
export function DrawerHeading({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2.5 font-semibold text-(--c-ink)">
        <span className="grid size-8 place-items-center rounded-lg bg-(--c-accent-soft) text-(--c-accent)">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {title}
      </h3>
      {action}
    </div>
  );
}

/**
 * O parte a formularului ca un card alb (cine, ce, cum plătește): pe fundalul
 * gri al panoului, grupurile se văd dintr-o privire. `lines` marchează cardul
 * cu rândurile de produse, pentru navigarea cu Enter.
 */
export function DrawerCard({
  icon,
  title,
  action,
  lines = false,
  className = "",
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  lines?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const modal = useContext(DrawerModalContext);
  if (modal) {
    return (
      <ModalSection icon={icon} title={title} action={action} lines={lines}>
        {children}
      </ModalSection>
    );
  }
  return (
    <section
      data-drawer-lines={lines ? "" : undefined}
      className={`grid content-start gap-3 crm-card p-4 ${className}`}
    >
      <DrawerHeading icon={icon} title={title} action={action} />
      {children}
    </section>
  );
}

/** Totalul documentului: cardul închis, cel mai vizibil lucru din formular. */
export function DrawerTotal({ total, vat }: { total: string; vat: string }) {
  return (
    <div className="self-start rounded-xl bg-(--c-accent) px-4 py-3.5 text-right text-white shadow-sm">
      <p className="text-sm text-white/70">Total</p>
      <p className="text-[1.75rem] font-semibold leading-tight tracking-tight tabular-nums">{total} lei</p>
      <p className="text-xs text-white/60">din care TVA {vat} lei</p>
    </div>
  );
}

export function DrawerSection({
  title,
  icon,
  description,
  action,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** O singură frază, doar când previne o greșeală (ex. la inventar). */
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section data-drawer-lines className="grid gap-3 overflow-visible crm-card p-4">
      {icon ? (
        <DrawerHeading icon={icon} title={title} action={action} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-(--c-ink)">{title}</h3>
          {action}
        </div>
      )}
      {description ? <p className="-mt-1 text-sm text-(--c-muted)">{description}</p> : null}
      <div className="grid">{children}</div>
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
  /** Primește starea returnată de acțiune — acolo vine entitatea creată (`created`). */
  onSuccess?: (state: S) => void,
  /** false = succesul are deja alt semnal pe ecran, deci nu mai iese notificare. */
  toastSuccess = true,
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
      onSuccess?.(state as S);
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
    // Un dialog-copil își randează formularul în portal, dar evenimentul urcă
    // prin arborele React: fără asta ar trimite și formularul părinte.
    event.stopPropagation();
    const form = event.currentTarget;
    formRef.current = form;
    send(new FormData(form));
  }

  function retry() {
    if (lastFormData.current) send(lastFormData.current);
  }

  // Memoizat: fără asta obiectul se reconstruia la FIECARE randare cât timp
  // `failure` e setat, iar notificarea (care se declanșează pe identitate) ar
  // fi ieșit din nou la fiecare tastare în formular.
  const publicState = useMemo(
    // Eșecul de transport bate ultimul răspuns al serverului până la reîncercare.
    () => (failure ? { ...state, ok: false, message: failure } : state) as S,
    [state, failure],
  );
  /** Dat = trimiterea n-a ajuns la server; retrimite același FormData. */
  const publicRetry = failure ? retry : undefined;

  useActionToast(publicState, { onRetry: publicRetry, success: toastSuccess });

  return { state: publicState, pending, onSubmit, retry: publicRetry };
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
    <div className="flex items-center justify-end gap-2 border-t border-(--c-line) pt-4">
      <CloseIconButton label="Anulează" onClick={onCancel} />
      <DrawerSubmit label={submitLabel} pending={pending} />
    </div>
  );
}

export function DrawerSubmit({ label, pending }: { label: string; pending?: boolean }) {
  // useFormStatus nu vede trimiterile manuale (useDrawerAction) — de aceea `pending`.
  const status = useFormStatus();
  const busy = pending ?? status.pending;
  return <SaveButton label={label} pending={busy} type="submit" />;
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
  // Ctrl+Enter = salvare (vezi `OperationDrawer`), nu „câmpul următor" sau rând nou.
  if (event.ctrlKey || event.metaKey) return;
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

/**
 * Shell-ul panoului, IDENTIC pentru toate dialogurile (operațiuni, produs,
 * partener, nomenclator). Lățimea e procentuală, nu `max-w-*` fix: cu 672px
 * rândurile de compatibilitate și tabelele documentelor își înghesuiau textul,
 * iar pe monitor rămâneau două treimi de ecran nefolosite.
 */
export const drawerPanelClassName =
  "motion-drawer-panel relative flex h-full w-full flex-col overflow-y-auto bg-(--c-surface-2) shadow-xl md:max-w-[90vw]";
export const drawerFormClassName = "grid gap-4 px-5 py-4";
export const drawerInputClassName =
  "field-control h-9 w-full rounded-md border border-(--c-line) bg-(--c-surface) px-2.5 text-sm outline-none placeholder:text-(--c-muted-2)";
export const drawerSecondaryButton =
  "button-secondary flex items-center gap-2 rounded-md border border-(--c-line) bg-(--c-surface) px-3 py-2 text-sm font-semibold text-(--c-ink) hover:bg-(--c-surface-2)";
export const drawerDangerButton =
  "button-danger line-offset mt-6 grid size-9 place-items-center rounded-md text-(--c-muted-2) hover:bg-(--c-red-soft) hover:text-(--c-red) disabled:cursor-not-allowed disabled:opacity-35";
/** Marchează un rând de produs, ca navigarea cu Enter să știe unde se află. */
const DRAWER_LINE_MARKER = "motion-line-item";
export const drawerLineClassName =
  `${DRAWER_LINE_MARKER} grid gap-2 border-t border-(--c-line-2) py-2.5 md:items-start`;
