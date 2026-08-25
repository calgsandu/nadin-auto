"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";
import {
  drawerBoundaryProps,
  drawerPanelClassName,
  useDrawerAction,
  useDrawerStackChild,
} from "@/app/components/operation-drawer";
import { useOptimisticOptions } from "@/app/components/use-optimistic-options";
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

function SubmitButton({ label, pending }: { label: string; pending?: boolean }) {
  const status = useFormStatus();
  const busy = pending ?? status.pending;
  return (
    <button
      type="submit"
      disabled={busy}
      className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Se salvează..." : label}
    </button>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid content-start gap-1.5 text-sm font-medium text-[#33312c] ${className}`}>
      {label}
      {children}
    </label>
  );
}

/** Generic drawer that owns the form + action state. `onSaved` closes on success. */
function Drawer({
  open,
  setOpen,
  title,
  action,
  children,
  submitLabel,
  onCreated,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  title: string;
  action: Action;
  children: ReactNode;
  submitLabel: string;
  /** Entitatea creată, pentru selectul din care s-a deschis dialogul. */
  onCreated?: (entity: { id: string; name: string }) => void;
}) {
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(open);
  const { pending, onSubmit } = useDrawerAction(action, initial, (saved) => {
    setOpen(false);
    setMounted(false);
    if (saved.created) onCreated?.(saved.created);
  });
  // Cât timp panoul ăsta e deschis, cel din care s-a plecat se ascunde.
  useDrawerStackChild(open);

  // Latch: o dată deschis, panoul rămâne montat (ciorna nu se pierde la închidere).
  if (open && !mounted) setMounted(true);
  if (!mounted) return null;

  return (
    <DrawerPortal locked={open}>
    <div
      className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30"
      style={open ? undefined : { display: "none" }}
      {...drawerBoundaryProps}
    >
      <button className="absolute inset-0 cursor-default" type="button" aria-label="Închide" onClick={() => setOpen(false)} />
      <aside
        className={drawerPanelClassName}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          setOpen(false);
        }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-[#1b1a17]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-medium text-[#1b1a17] hover:bg-[#f6f6f4]"
          >
            Închide
          </button>
        </div>
        <form onSubmit={onSubmit} className="grid gap-5 px-6 py-6 lg:grid-cols-2">
          {children}
          <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5 lg:col-span-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-4 py-2.5 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
            >
              Anulează
            </button>
            <SubmitButton label={submitLabel} pending={pending} />
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
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: {
  entityName: string;
  entity?: { id: string; name: string; nameRu?: string | null };
  createAction: Action;
  updateAction: Action;
  /** Ignorat în modul controlat. */
  triggerLabel?: string;
  triggerKind?: "primary" | "row";
  placeholder?: string;
  translated?: boolean;
  /** Dat = mod controlat: fără buton propriu, deschiderea vine din selectul-părinte. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (entity: { id: string; name: string }) => void;
}) {
  const controlled = controlledOpen !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const open = controlled ? controlledOpen : selfOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setSelfOpen(next);
    onOpenChange?.(next);
  };
  return (
    <>
      {controlled ? null : (
        <TriggerButton label={triggerLabel ?? ""} kind={triggerKind} onClick={() => setOpen(true)} />
      )}
      <Drawer
        open={open}
        setOpen={setOpen}
        title={entity ? `Editează ${entityName.toLowerCase()}` : `Adaugă ${entityName.toLowerCase()}`}
        action={entity ? updateAction : createAction}
        submitLabel={entity ? "Salvează" : "Adaugă"}
        onCreated={onCreated}
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
        title={warehouse ? "Editează depozit" : "Adaugă depozit"}
        action={warehouse ? updateWarehouseAction : createWarehouseAction}
        submitLabel={warehouse ? "Salvează" : "Adaugă"}
      >
        {warehouse ? <input type="hidden" name="id" value={warehouse.id} /> : null}
        <Field label="Nume">
          <input className={inputClassName} name="name" defaultValue={warehouse?.name ?? ""} placeholder="ex. Pavilion 110A" required />
        </Field>
        <label className="flex items-center gap-2 self-start text-sm text-[#33312c] lg:col-span-2">
          <input type="checkbox" name="isDefault" defaultChecked={warehouse?.isDefault ?? false} /> Depozit implicit
        </label>
        <label className="flex items-center gap-2 self-start text-sm text-[#33312c] lg:col-span-2">
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
  defaultBrandId,
  triggerLabel,
  triggerKind = "primary",
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: {
  brands: { id: string; name: string }[];
  model?: { id: string; name: string; brandId: string };
  /** Brandul deja ales pe rândul din care s-a deschis dialogul. */
  defaultBrandId?: string;
  /** Ignorat în modul controlat. */
  triggerLabel?: string;
  triggerKind?: "primary" | "row";
  /** Dat = mod controlat: deschis din selectul de model al altui dialog. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (entity: { id: string; name: string }) => void;
}) {
  const controlled = controlledOpen !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const open = controlled ? controlledOpen : selfOpen;
  const setOpen = (next: boolean) => {
    if (!controlled) setSelfOpen(next);
    onOpenChange?.(next);
  };
  return (
    <>
      {controlled ? null : (
        <TriggerButton label={triggerLabel ?? ""} kind={triggerKind} onClick={() => setOpen(true)} />
      )}
      <Drawer
        open={open}
        setOpen={setOpen}
        title={model ? "Editează model" : "Adaugă model"}
        action={model ? updateModelAction : createModelAction}
        submitLabel={model ? "Salvează" : "Adaugă"}
        onCreated={onCreated}
      >
        {model ? <input type="hidden" name="id" value={model.id} /> : null}
        <Field label="Brand">
          {/* Lanțul se închide aici: modelul unui brand nou se face fără să ieși. */}
          <BrandSelect
            defaultValue={model?.brandId ?? defaultBrandId ?? ""}
            brands={brands}
            name="brandId"
            required
          />
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
  brands = [],
  fitment,
  triggerLabel,
  triggerKind = "primary",
}: {
  models: { id: string; label: string }[];
  /** Necesare dialogului de model deschis din interior; fără ele butonul dispare. */
  brands?: { id: string; name: string }[];
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
        title={fitment ? "Editează compatibilitate" : "Adaugă compatibilitate"}
        action={fitment ? updateFitmentAction : createFitmentAction}
        submitLabel={fitment ? "Salvează" : "Adaugă"}
      >
        {fitment ? <input type="hidden" name="id" value={fitment.id} /> : null}
        <Field label="Model">
          <ModelSelect
            brands={brands}
            defaultValue={fitment?.carModelId ?? ""}
            models={models.map((m) => ({ id: m.id, name: m.label }))}
            name="carModelId"
            required
          />
        </Field>
        <Field label="Etichetă (generație)">
          <input className={inputClassName} name="label" defaultValue={fitment?.label ?? ""} placeholder="ex. B6 (2005-2010)" required />
        </Field>
        <Field label="Etichetă în rusă">
          <input className={inputClassName} name="labelRu" defaultValue={fitment?.labelRu ?? ""} placeholder="ex. все годы" />
        </Field>
        <Field label="An început">
          <input className={inputClassName} name="yearStart" defaultValue={fitment?.yearStart ?? ""} inputMode="numeric" placeholder="2005" />
        </Field>
        <Field label="An sfârșit">
          <input className={inputClassName} name="yearEnd" defaultValue={fitment?.yearEnd ?? ""} inputMode="numeric" placeholder="2010" />
        </Field>
        <label className="flex items-center gap-2 self-start text-sm text-[#33312c] lg:col-span-2">
          <input type="checkbox" name="yearOpenEnded" defaultChecked={fitment?.yearOpenEnded ?? false} /> În continuare (fără an de sfârșit)
        </label>
      </Drawer>
    </>
  );
}


/* ------------------------- Selecte cu creare pe loc ------------------------ */

/**
 * Brandul ales, cu ieșire spre dialogul de brand.
 *
 * Brandul creat intră optimist în listă și rămâne selectat: `revalidatePath`
 * reîmprospătează pagina, dar prop-ul sosește după ce selectul a primit deja
 * valoarea, iar rândul ar fi rămas gol exact în secunda în care te uiți la el.
 */
export function BrandSelect({
  brands,
  name,
  defaultValue = "",
  value,
  onChange,
  required,
}: {
  brands: readonly { id: string; name: string }[];
  name?: string;
  defaultValue?: string;
  /** Dat = selectul e controlat de părinte (rândurile din „Alte compatibilități"). */
  value?: string;
  onChange?: (brandId: string) => void;
  required?: boolean;
}) {
  const { options, add } = useOptimisticOptions(brands);
  const controlled = value !== undefined;
  const [selfValue, setSelfValue] = useState(defaultValue);
  const [creating, setCreating] = useState(false);
  const current = controlled ? value : selfValue;

  function select(next: string) {
    if (!controlled) setSelfValue(next);
    onChange?.(next);
  }

  return (
    <div className="grid gap-2">
      <select
        className={inputClassName}
        name={name}
        required={required}
        value={current}
        onChange={(event) => select(event.currentTarget.value)}
      >
        <option value="">Alege brandul</option>
        {options.map((brand) => (
          <option key={brand.id} value={brand.id}>{brand.name}</option>
        ))}
      </select>
      <button
        className="button-secondary justify-self-start rounded-md border border-[#e8e7e3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
        type="button"
        onClick={() => setCreating(true)}
      >
        Brand nou
      </button>
      <BrandDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(brand) => {
          add(brand);
          select(brand.id);
        }}
      />
    </div>
  );
}

/** Modelul ales, cu ieșire spre dialogul de model (care are la rândul lui „Brand nou"). */
export function ModelSelect({
  models,
  brands,
  name,
  defaultValue = "",
  value,
  onChange,
  required,
  emptyLabel = "Alege modelul",
  defaultBrandId,
}: {
  models: readonly { id: string; name: string }[];
  brands: readonly { id: string; name: string }[];
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (modelId: string) => void;
  required?: boolean;
  emptyLabel?: string;
  /** Brandul rândului: modelul nou se creează implicit sub el. */
  defaultBrandId?: string;
}) {
  const { options, add } = useOptimisticOptions(models);
  const controlled = value !== undefined;
  const [selfValue, setSelfValue] = useState(defaultValue);
  const [creating, setCreating] = useState(false);
  const current = controlled ? value : selfValue;

  function select(next: string) {
    if (!controlled) setSelfValue(next);
    onChange?.(next);
  }

  return (
    <div className="grid gap-2">
      <select
        className={inputClassName}
        name={name}
        required={required}
        value={current}
        onChange={(event) => select(event.currentTarget.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((model) => (
          <option key={model.id} value={model.id}>{model.name}</option>
        ))}
      </select>
      {/* Fără lista de branduri n-am ce pune în dialogul de model. */}
      {brands.length > 0 ? (
        <>
          <button
            className="button-secondary justify-self-start rounded-md border border-[#e8e7e3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
            type="button"
            onClick={() => setCreating(true)}
          >
            Model nou
          </button>
          <ModelDialog
            brands={[...brands]}
            defaultBrandId={defaultBrandId}
            open={creating}
            onOpenChange={setCreating}
            onCreated={(model) => {
              add(model);
              select(model.id);
            }}
          />
        </>
      ) : null}
    </div>
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
      <ActionFeedback state={state} />
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
