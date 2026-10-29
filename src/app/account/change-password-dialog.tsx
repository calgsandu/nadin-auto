"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { useActionToast } from "@/app/components/action-toast";
import { drawerPanelClassName } from "@/app/components/operation-drawer";
import {
  changeOwnPasswordAction,
  type PasswordChangeState,
} from "@/app/account/actions";

const initialState: PasswordChangeState = { ok: false, message: "" };

export function ChangePasswordDialog({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        title="Schimbă parola"
        aria-label="Schimbă parola"
        className={`button-secondary inline-flex items-center justify-center rounded-xl border border-[#e4e4e7] bg-white font-semibold text-[#52525b] hover:text-[#18181b] ${compact ? "size-8 text-xs" : "px-3 py-2 text-sm"}`}
        onClick={() => setOpen(true)}
      >
        {compact ? "••" : "Schimbă parola"}
      </button>
      {open ? <PasswordDrawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PasswordDrawer({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useActionState(changeOwnPasswordAction, initialState);
  // Succesul are deja panoul lui pe ecran; doar eroarea are nevoie de notificare.
  useActionToast(state, { success: false });
  return (
    <DrawerPortal>
      <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
        <button className="absolute inset-0 cursor-default" type="button" aria-label="Închide" onClick={onClose} />
        <aside className={drawerPanelClassName}>
          <div className="flex items-start justify-between border-b border-[#e4e4e7] px-6 py-5">
            <div>
              <h2 className="mt-1 text-lg font-semibold">Schimbă parola</h2>
            </div>
            <button className="button-secondary rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-xs font-semibold" type="button" onClick={onClose}>Închide</button>
          </div>
          {state.ok ? (
            <div className="grid gap-4 px-5 py-4">
              <div className="rounded-md border border-[#86efac] bg-[#f0fdf4] px-3 py-3 text-sm text-[#166534]">{state.message}</div>
              <button className="button-primary justify-self-end rounded-md bg-[#2563eb] px-3.5 py-2 text-sm font-semibold text-white" type="button" onClick={onClose}>Închide</button>
            </div>
          ) : (
            <form action={formAction} className="grid gap-4 px-5 py-4">
              <div className="grid gap-4 md:grid-cols-3">
                <PasswordInput name="currentPassword" label="Parola actuală" autoComplete="current-password" />
                <PasswordInput name="newPassword" label="Parola nouă" autoComplete="new-password" />
                <PasswordInput name="confirmPassword" label="Confirmă parola nouă" autoComplete="new-password" />
              </div>
              <div className="flex justify-end gap-3 border-t border-[#e4e4e7] pt-5">
                <button className="button-secondary rounded-md border border-[#e4e4e7] bg-white px-3.5 py-2 text-sm font-semibold" type="button" onClick={onClose}>Anulează</button>
                <PasswordSubmit />
              </div>
            </form>
          )}
        </aside>
      </div>
    </DrawerPortal>
  );
}

function PasswordInput({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
  return <label className="grid gap-1 text-sm font-medium text-[#3f3f46]">{label}<input className="field-control h-10 rounded-md border border-[#e4e4e7] bg-white px-3 outline-none" name={name} type="password" autoComplete={autoComplete} required minLength={8} /></label>;
}

function PasswordSubmit() {
  const { pending } = useFormStatus();
  return <button className="button-primary rounded-md bg-[#2563eb] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Se schimbă..." : "Schimbă parola"}</button>;
}
