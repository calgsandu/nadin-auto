"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { useActionToast } from "@/app/components/action-toast";
import { drawerPanelClassName } from "@/app/components/operation-drawer";
import {
  changeOwnPasswordAction,
  type PasswordChangeState,
} from "@/app/account/actions";
import { CloseIconButton, SaveIconButton } from "@/app/components/icon-buttons";

const initialState: PasswordChangeState = { ok: false, message: "" };

export function ChangePasswordDialog({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        title="Schimbă parola"
        aria-label="Schimbă parola"
        className={`button-secondary inline-flex items-center justify-center rounded-lg border border-[#e4e4e7] bg-white font-semibold text-[#52525b] hover:text-[#18181b] ${compact ? "size-8" : "gap-2 px-3 py-2 text-sm"}`}
        onClick={() => setOpen(true)}
      >
        <KeyRound className="size-4" aria-hidden="true" />
        {compact ? null : "Schimbă parola"}
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
            <CloseIconButton onClick={onClose} />
          </div>
          {state.ok ? (
            <div className="grid gap-4 px-5 py-4">
              <div className="rounded-md border border-[#86efac] bg-[#f0fdf4] px-3 py-3 text-sm text-[#166534]">{state.message}</div>
              <button className="button-primary justify-self-end rounded-md bg-[#18181b] px-3.5 py-2 text-sm font-semibold text-white" type="button" onClick={onClose}>Închide</button>
            </div>
          ) : (
            <form action={formAction} className="grid gap-4 px-5 py-4">
              <div className="grid gap-4 md:grid-cols-3">
                <PasswordInput name="currentPassword" label="Parola actuală" autoComplete="current-password" />
                <PasswordInput name="newPassword" label="Parola nouă" autoComplete="new-password" />
                <PasswordInput name="confirmPassword" label="Confirmă parola nouă" autoComplete="new-password" />
              </div>
              <div className="flex justify-end gap-2 border-t border-[#e4e4e7] pt-5">
                <CloseIconButton label="Anulează" onClick={onClose} />
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
  return <SaveIconButton label="Schimbă parola" pending={pending} type="submit" />;
}
