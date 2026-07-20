"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { ActionFeedback } from "@/app/components/action-feedback";
import {
  createBrandAction,
  updateBrandAction,
  createTypeAction,
  updateTypeAction,
  createModelAction,
  updateModelAction,
  createFitmentAction,
  updateFitmentAction,
  createWarehouseAction,
  updateWarehouseAction,
  type AdminActionState,
} from "@/app/admin/actions";

type Action = (state: AdminActionState, fd: FormData) => Promise<AdminActionState>;

const initial: AdminActionState = { ok: false, message: "" };
const inputClassName =
  "h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm text-[#1b1a17] outline-none transition focus:border-[#2e90fa] focus:ring-2 focus:ring-[#2e90fa]/30 placeholder:text-[#98948b]";

function TriggerButton({ label, kind, onClick }: { label: string; kind: "primary" | "row"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        kind === "row"
          ? "button-secondary rounded-md border border-[#e8e7e3] px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
          : "button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
      }
    >
      {label}
    </button>
  );
}

function SubmitButton({ label }: { label: string }) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {status.pending ? "Se salvează..." : label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#33312c]">
      {label}
      {children}
    </label>
  );
}

/** Generic drawer that owns the form + action state. `onSaved` closes on success. */
function Drawer({
  open,
  setOpen,
  eyebrow,
  title,
  action,
  children,
  submitLabel,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  eyebrow: string;
  title: string;
  action: Action;
  children: ReactNode;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok, setOpen]);

  if (!open) return null;

  return (
    <DrawerPortal>
    <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Închide" onClick={() => setOpen(false)} />
      <aside className="motion-drawer-panel relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[#fafaf9] shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#6f6b63]">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-medium text-[#1b1a17] hover:bg-[#f6f6f4]"
          >
            Închide
          </button>
        </div>
        <form action={formAction} className="grid gap-5 px-6 py-6">
          {children}
          {state.message && !state.ok ? (
            <div className="rounded-md border border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
              {state.message}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-4 py-2.5 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
            >
              Anulează
            </button>
            <SubmitButton label={submitLabel} />
          </div>
        </form>
      </aside>
    </div>
    </DrawerPortal>
  );
}

/* ----------------------------- Name-only (Brand / Type) ---------------------------- */

export function NameDialog({
  entityName,
  entity,
  createAction,
  updateAction,
  triggerLabel,
  triggerKind = "primary",
  placeholder,
  translated = false,
}: {
  entityName: string;
  entity?: { id: string; name: string; nameRu?: string | null };
  createAction: Action;
  updateAction: Action;
  triggerLabel: string;
  triggerKind?: "primary" | "row";
  placeholder?: string;
  translated?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TriggerButton label={triggerLabel} kind={triggerKind} onClick={() => setOpen(true)} />
      <Drawer
        open={open}
        setOpen={setOpen}
        eyebrow={entityName}
        title={entity ? `Editează ${entityName.toLowerCase()}` : `Adaugă ${entityName.toLowerCase()}`}
        action={entity ? updateAction : createAction}
        submitLabel={entity ? "Salvează" : "Adaugă"}
      >
        {entity ? <input type="hidden" name="id" value={entity.id} /> : null}
        <Field label="Nume">
          <input className={inputClassName} name="name" defaultValue={entity?.name ?? ""} placeholder={placeholder} required />
        </Field>
        {translated ? (
          <Field label="Nume în rusă">
            <input
              className={inputClassName}
              name="nameRu"
              defaultValue={entity?.nameRu ?? ""}
              placeholder="ex. Порог, Крыло, Фара"
            />
          </Field>
        ) : null}
      </Drawer>
    </>
  );
}

export function BrandDialog(props: Omit<Parameters<typeof NameDialog>[0], "entityName" | "createAction" | "updateAction" | "placeholder">) {
  return <NameDialog {...props} entityName="Brand" createAction={createBrandAction} updateAction={updateBrandAction} placeholder="ex. Volkswagen" />;
}

export function TypeDialog(props: Omit<Parameters<typeof NameDialog>[0], "entityName" | "createAction" | "updateAction" | "placeholder" | "translated">) {
  return <NameDialog {...props} entityName="Tip produs" createAction={createTypeAction} updateAction={updateTypeAction} placeholder="ex. Prag, Aripă, Far" translated />;
}

/* --------------------------------- Warehouse --------------------------------- */

export function WarehouseDialog({
  warehouse,
  triggerLabel,
  triggerKind = "primary",
}: {
  warehouse?: { id: string; name: string; isDefault: boolean; active: boolean };
  triggerLabel: string;
  triggerKind?: "primary" | "row";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TriggerButton label={triggerLabel} kind={triggerKind} onClick={() => setOpen(true)} />
      <Drawer
        open={open}
        setOpen={setOpen}
        eyebrow="Depozit"
        title={warehouse ? "Editează depozit" : "Adaugă depozit"}
        action={warehouse ? updateWarehouseAction : createWarehouseAction}
        submitLabel={warehouse ? "Salvează" : "Adaugă"}
      >
        {warehouse ? <input type="hidden" name="id" value={warehouse.id} /> : null}
        <Field label="Nume">
          <input className={inputClassName} name="name" defaultValue={warehouse?.name ?? ""} placeholder="ex. Pavilion 110A" required />
        </Field>
        <label className="flex items-center gap-2 text-sm text-[#33312c]">
          <input type="checkbox" name="isDefault" defaultChecked={warehouse?.isDefault ?? false} /> Depozit implicit
        </label>
        <label className="flex items-center gap-2 text-sm text-[#33312c]">
          <input type="checkbox" name="active" defaultChecked={warehouse?.active ?? true} /> Activ
        </label>
      </Drawer>
    </>
  );
}

/* ---------------------------------- CarModel --------------------------------- */

export function ModelDialog({
  brands,
  model,
  triggerLabel,
  triggerKind = "primary",
}: {
  brands: { id: string; name: string }[];
  model?: { id: string; name: string; brandId: string };
  triggerLabel: string;
  triggerKind?: "primary" | "row";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TriggerButton label={triggerLabel} kind={triggerKind} onClick={() => setOpen(true)} />
      <Drawer
        open={open}
        setOpen={setOpen}
        eyebrow="Model auto"
        title={model ? "Editează model" : "Adaugă model"}
        action={model ? updateModelAction : createModelAction}
        submitLabel={model ? "Salvează" : "Adaugă"}
      >
        {model ? <input type="hidden" name="id" value={model.id} /> : null}
        <Field label="Brand">
          <select className={inputClassName} name="brandId" defaultValue={model?.brandId ?? ""} required>
            <option value="">Alege brandul</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Nume model">
          <input className={inputClassName} name="name" defaultValue={model?.name ?? ""} placeholder="ex. Passat B6" required />
        </Field>
      </Drawer>
    </>
  );
}

/* ------------------------------- VehicleFitment ------------------------------ */

export function FitmentDialog({
  models,
  fitment,
  triggerLabel,
  triggerKind = "primary",
}: {
  models: { id: string; label: string }[];
  fitment?: {
    id: string;
    carModelId: string;
    label: string;
    labelRu: string | null;
    yearStart: number | null;
    yearEnd: number | null;
    yearOpenEnded: boolean;
  };
  triggerLabel: string;
  triggerKind?: "primary" | "row";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TriggerButton label={triggerLabel} kind={triggerKind} onClick={() => setOpen(true)} />
      <Drawer
        open={open}
        setOpen={setOpen}
        eyebrow="Compatibilitate"
        title={fitment ? "Editează compatibilitate" : "Adaugă compatibilitate"}
        action={fitment ? updateFitmentAction : createFitmentAction}
        submitLabel={fitment ? "Salvează" : "Adaugă"}
      >
        {fitment ? <input type="hidden" name="id" value={fitment.id} /> : null}
        <Field label="Model">
          <select className={inputClassName} name="carModelId" defaultValue={fitment?.carModelId ?? ""} required>
            <option value="">Alege modelul</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Etichetă (generație)">
          <input className={inputClassName} name="label" defaultValue={fitment?.label ?? ""} placeholder="ex. B6 (2005-2010)" required />
        </Field>
        <Field label="Etichetă în rusă">
          <input className={inputClassName} name="labelRu" defaultValue={fitment?.labelRu ?? ""} placeholder="ex. все годы" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="An început">
            <input className={inputClassName} name="yearStart" defaultValue={fitment?.yearStart ?? ""} inputMode="numeric" placeholder="2005" />
          </Field>
          <Field label="An sfârșit">
            <input className={inputClassName} name="yearEnd" defaultValue={fitment?.yearEnd ?? ""} inputMode="numeric" placeholder="2010" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#33312c]">
          <input type="checkbox" name="yearOpenEnded" defaultChecked={fitment?.yearOpenEnded ?? false} /> În continuare (fără an de sfârșit)
        </label>
      </Drawer>
    </>
  );
}

/* ------------------------------- Delete button ------------------------------ */

export function AdminDeleteButton({
  action,
  id,
  confirmLabel,
}: {
  action: Action;
  id: string;
  confirmLabel: string;
}) {
  const [state, formAction] = useActionState(action, initial);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(e) => {
        if (!window.confirm(`Ștergi ${confirmLabel}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteSubmit />
      <ActionFeedback state={state} compact />
    </form>
  );
}

function DeleteSubmit() {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="button-secondary rounded-md border border-[#fca5a5] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {status.pending ? "..." : "Șterge"}
    </button>
  );
}
