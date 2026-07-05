"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import type { AppRole } from "@/generated/prisma/enums";
import {
  deleteUserAction,
  setUserRoleAction,
  type StaffActionState,
} from "@/app/staff/actions";

const initialState: StaffActionState = { ok: false, message: "" };

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "ADMIN", label: "Administrator" },
  { value: "DIRECTOR", label: "Director" },
  { value: "ANGAJAT", label: "Angajat" },
];

export function RoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: AppRole;
}) {
  const [state, formAction] = useActionState(setUserRoleAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input name="userId" type="hidden" value={userId} />
      <select
        className="field-control h-9 rounded-md border border-[#e8e7e3] bg-white px-2 text-sm outline-none"
        name="role"
        defaultValue={currentRole}
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <SaveButton />
      {state.message ? (
        <span
          className={`text-xs ${state.ok ? "text-[#166534]" : "text-[#b91c1c]"}`}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function SaveButton() {
  const status = useFormStatus();
  return (
    <button
      className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "..." : "Salvează"}
    </button>
  );
}

export function StaffDeleteButton({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const [state, formAction] = useActionState(deleteUserAction, initialState);

  useEffect(() => {
    if (state.message && !state.ok) window.alert(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Ștergi utilizatorul „${label}”?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="userId" type="hidden" value={userId} />
      <DeleteButton />
    </form>
  );
}

function DeleteButton() {
  const status = useFormStatus();
  return (
    <button
      className="button-secondary rounded-md border border-[#fca5a5] bg-white px-3 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "..." : "Șterge"}
    </button>
  );
}
