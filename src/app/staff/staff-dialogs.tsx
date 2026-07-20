"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { ActionFeedback } from "@/app/components/action-feedback";
import {
  createStaffUserAction,
  resetStaffPasswordAction,
  resetStaffTwoFactorAction,
  setStaffActiveAction,
  type StaffActionState,
} from "@/app/staff/actions";
import type { AppRole } from "@/generated/prisma/enums";

const initialState: StaffActionState = { ok: false, message: "" };
const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "ADMIN", label: "Administrator" },
  { value: "DIRECTOR", label: "Director" },
  { value: "ANGAJAT", label: "Angajat" },
];

export function CreateStaffDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
        type="button"
        onClick={() => setOpen(true)}
      >
        Adaugă utilizator
      </button>
      {open ? <CreateStaffDrawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function CreateStaffDrawer({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(createStaffUserAction, initialState);
  const [password, setPassword] = useState("");

  return (
    <StaffDrawer title="Adaugă utilizator" onClose={onClose}>
      {state.ok && state.revealedPassword ? (
        <RevealedPassword password={state.revealedPassword} onClose={onClose} />
      ) : (
        <form action={formAction} className="grid gap-5">
          <Field label="Nume">
            <input className={inputClassName} name="name" required placeholder="ex. Ion Popescu" />
          </Field>
          <Field label="Nume de utilizator">
            <input
              className={inputClassName}
              name="username"
              required
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ex. ion"
            />
          </Field>
          <Field label="Rol">
            <select className={inputClassName} name="role" defaultValue="ANGAJAT">
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <PasswordField value={password} onChange={setPassword} />
          <ActionMessage state={state} />
          <DrawerActions onClose={onClose} submitLabel="Creează utilizator" />
        </form>
      )}
    </StaffDrawer>
  );
}

export function ResetPasswordDialog({ userId, username }: { userId: string; username: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowButton onClick={() => setOpen(true)}>Resetează parola</RowButton>
      {open ? (
        <ResetPasswordDrawer userId={userId} username={username} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ResetPasswordDrawer({ userId, username, onClose }: { userId: string; username: string; onClose: () => void }) {
  const [state, formAction] = useActionState(resetStaffPasswordAction, initialState);
  const [password, setPassword] = useState("");
  return (
    <StaffDrawer title={`Parolă nouă · ${username}`} onClose={onClose}>
      {state.ok && state.revealedPassword ? (
        <RevealedPassword password={state.revealedPassword} onClose={onClose} />
      ) : (
        <form action={formAction} className="grid gap-5">
          <input type="hidden" name="userId" value={userId} />
          <PasswordField value={password} onChange={setPassword} />
          <ActionMessage state={state} />
          <DrawerActions onClose={onClose} submitLabel="Resetează parola" />
        </form>
      )}
    </StaffDrawer>
  );
}

export function ResetTwoFactorDialog({ userId, username }: { userId: string; username: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowButton onClick={() => setOpen(true)}>Resetează 2FA</RowButton>
      {open ? (
        <ResetTwoFactorDrawer
          userId={userId}
          username={username}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ResetTwoFactorDrawer({
  userId,
  username,
  onClose,
}: {
  userId: string;
  username: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(resetStaffTwoFactorAction, initialState);

  return (
    <StaffDrawer title={`Resetare 2FA · ${username}`} onClose={onClose}>
      <form action={formAction} className="grid gap-5">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="username" value={username} />
        <div className="rounded-lg border border-[#fca5a5] bg-[#fef2f2] p-4 text-sm leading-6 text-[#991b1b]">
          Resetarea invalidează toate sesiunile 2FA și dispozitivele memorate. Utilizatorul
          va trebui să configureze din nou aplicația de autentificare.
        </div>
        <Field label={`Scrie exact „${username}” pentru confirmare`}>
          <input
            className={inputClassName}
            name="confirmation"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={username}
          />
        </Field>
        <ActionMessage state={state} />
        <DrawerActions onClose={onClose} submitLabel="Resetează 2FA" />
      </form>
    </StaffDrawer>
  );
}

export function StaffActiveButton({ userId, active, label }: { userId: string; active: boolean; label: string }) {
  const [state, formAction] = useActionState(setStaffActiveAction, initialState);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(event) => {
        const action = active ? "dezactivezi" : "reactivezi";
        if (!window.confirm(`Sigur ${action} contul „${label}”?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <ActiveSubmit active={active} />
      <ActionFeedback state={state} compact />
    </form>
  );
}

function StaffDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <DrawerPortal>
      <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
        <button className="absolute inset-0 cursor-default" type="button" aria-label="Închide" onClick={onClose} />
        <aside className="motion-drawer-panel relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-[#fafaf9] shadow-xl">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#6f6b63]">Personal</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">{title}</h2>
            </div>
            <RowButton onClick={onClose}>Închide</RowButton>
          </div>
          <div className="px-6 py-6">{children}</div>
        </aside>
      </div>
    </DrawerPortal>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field label="Parolă">
      <div className="flex gap-2">
        <input
          className={inputClassName}
          name="password"
          type="text"
          autoComplete="new-password"
          required
          minLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 text-xs font-semibold" type="button" onClick={() => onChange(generatePassword())}>
          Generează
        </button>
      </div>
    </Field>
  );
}

function RevealedPassword({ password, onClose }: { password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-[#7cb8f5] bg-[#f0f7ff] p-4 text-sm text-[#194185]">
        Copiază parola acum. După închiderea ferestrei nu mai poate fi afișată.
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-[#e8e7e3] bg-white p-3">
        <code className="min-w-0 flex-1 break-all font-mono text-sm">{password}</code>
        <button
          className="button-secondary rounded-md border border-[#e8e7e3] px-3 py-2 text-xs font-semibold"
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          }}
        >
          {copied ? "Copiat" : "Copiază"}
        </button>
      </div>
      <button className="button-primary justify-self-end rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white" type="button" onClick={onClose}>
        Am salvat parola
      </button>
    </div>
  );
}

function DrawerActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-3 border-t border-[#e8e7e3] pt-5">
      <RowButton onClick={onClose}>Anulează</RowButton>
      <PendingSubmit label={submitLabel} />
    </div>
  );
}

function PendingSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Se salvează..." : label}</button>;
}

function ActiveSubmit({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return <button className={`button-secondary rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${active ? "border-[#fca5a5] text-[#b91c1c]" : "border-[#86efac] text-[#166534]"}`} disabled={pending} type="submit">{pending ? "..." : active ? "Dezactivează" : "Reactivează"}</button>;
}

function RowButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]" type="button" onClick={onClick}>{children}</button>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-[#33312c]">{label}{children}</label>;
}

function ActionMessage({ state }: { state: StaffActionState }) {
  if (!state.message) return null;
  return <div className={`rounded-md border px-3 py-2 text-sm ${state.ok ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]" : "border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]"}`}>{state.message}</div>;
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

const inputClassName = "field-control h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm outline-none placeholder:text-[#98948b]";
