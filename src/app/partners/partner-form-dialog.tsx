"use client";

import { useRef, useState, type ReactNode } from "react";
import { Handshake, Landmark, Pencil, UserRound } from "lucide-react";
import type { PartnerKind } from "@/generated/prisma/enums";
import {
  createPartnerAction,
  updatePartnerAction,
  type PartnerActionState,
} from "@/app/partners/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { CloseIconButton, IconLabel, rowIconButtonCls, SaveButton } from "@/app/components/icon-buttons";
import {
  DrawerCard,
  drawerBoundaryProps,
  handleEnterNavigation,
  useDrawerAction,
  useModalFocus,
  DrawerModalScope,
  modalBackdropClassName,
  modalHeaderClassName,
  modalPanelClassName,
} from "@/app/components/operation-drawer";

export type PartnerFormValue = {
  id: string;
  name: string;
  kind: PartnerKind;
  phone: string;
  email: string;
  address: string;
  idno: string;
  vatCode: string;
  iban: string;
  bankName: string;
  bankCode: string;
  notes: string;
  /** Procente, ca text de formular. "" = fără discount. */
  discountPercent: string;
};

type PartnerFormDialogProps = {
  partner?: PartnerFormValue;
  /** Ignorat în modul controlat (butonul îl randează cel care deschide dialogul). */
  triggerLabel?: string;
  triggerKind?: "primary" | "row";
  /** Tipul preselectat la creare — „Furnizor nou" din recepție nu mai cere alegerea. */
  defaultKind?: PartnerKind;
  /** Dat = mod controlat: deschiderea o decide dialogul din care s-a plecat. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (partner: {
    id: string;
    name: string;
    discountPercent: number | null;
    idno: string | null;
    address: string | null;
  }) => void;
  /** Preumple numele cu ce apucase operatorul să tasteze. */
  initialName?: string;
};

const initialState: PartnerActionState = { ok: false, message: "" };

const KIND_OPTIONS: { value: PartnerKind; label: string }[] = [
  { value: "SUPPLIER", label: "Furnizor" },
  { value: "CUSTOMER", label: "Client" },
  { value: "BOTH", label: "Furnizor și client" },
];

export function PartnerFormDialog({
  partner,
  triggerLabel,
  triggerKind = "primary",
  defaultKind,
  open: controlledOpen,
  onOpenChange,
  onCreated,
  initialName,
}: PartnerFormDialogProps) {
  const controlled = controlledOpen !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const open = controlled ? controlledOpen : selfOpen;
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const action = partner ? updatePartnerAction : createPartnerAction;
  const { pending, onSubmit } = useDrawerAction(action, initialState, (saved) => {
    setOpen(false);
    setMounted(false);
    // Formularul se remontează cu valorile inițiale: și verificările pornesc de la ele.
    setIdno(partner?.idno ?? "");
    setIban(partner?.iban ?? "");
    if (saved.created) onCreated?.(saved.created);
  });
  const formRef = useRef<HTMLFormElement>(null);
  // Modalul stă peste dialogul din care s-a plecat (ex. vânzarea), care rămâne în spate.
  useModalFocus(formRef, open);
  // Aceleași reguli ca pe server, dar spuse pe loc, nu abia la salvare.
  const [idno, setIdno] = useState(partner?.idno ?? "");
  const [iban, setIban] = useState(partner?.iban ?? "");
  const idnoProblem = idno.trim() && !/^\d{7,13}$/.test(idno.trim()) ? "IDNO-ul are 7–13 cifre." : "";
  const ibanValue = iban.replace(/\s+/g, "").toUpperCase();
  const ibanProblem = ibanValue && !/^[A-Z]{2}[A-Z0-9]{13,32}$/.test(ibanValue) ? "IBAN-ul nu pare valid (ex. MD24AG000225100013104168)." : "";

  function setOpen(next: boolean) {
    if (!controlled) setSelfOpen(next);
    onOpenChange?.(next);
  }

  // Latch: o dată deschis, panoul rămâne montat. Ajustare în timpul randării,
  // nu într-un efect — altfel prima randare a panoului ar fi goală.
  if (open && !mounted) setMounted(true);

  return (
    <>
      {controlled ? null : (
        <button
          className={
            triggerKind === "row"
              ? rowIconButtonCls
              : "button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-(--c-accent) px-3.5 py-2 text-sm font-semibold text-white hover:bg-(--c-accent-hover)"
          }
          title={triggerKind === "row" ? triggerLabel : undefined}
          type="button"
          onClick={() => setOpen(true)}
        >
          {triggerKind === "row" ? (
            <>
              <Pencil aria-hidden="true" />
              <IconLabel>{triggerLabel ?? "Editează"}</IconLabel>
            </>
          ) : (
            triggerLabel
          )}
        </button>
      )}

      {mounted ? (
        <DrawerPortal locked={open}>
          <div
            className={modalBackdropClassName}
            style={open ? undefined : { display: "none" }}
            {...drawerBoundaryProps}
          >
            <button
              className="absolute inset-0 cursor-default"
              type="button"
              aria-label="Închide formularul"
              onClick={() => setOpen(false)}
            />
            <aside
              className={modalPanelClassName("lg")}
              onKeyDown={(event) => {
                // Ca în celelalte panouri: Ctrl+Enter salvează, Esc închide.
                if ((event.ctrlKey || event.metaKey) && (event.key === "Enter" || event.key.toLowerCase() === "s")) {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!pending) formRef.current?.requestSubmit();
                  return;
                }
                if (event.key !== "Escape") return;
                event.stopPropagation();
                setOpen(false);
              }}
            >
              <div className={modalHeaderClassName(true)}>
                <h2 className="flex items-center gap-2.5 text-lg font-semibold text-(--c-ink)">
                  <span className="grid size-8 place-items-center rounded-lg bg-(--c-accent) text-white">
                    <Handshake className="size-4" aria-hidden="true" />
                  </span>
                  {partner ? "Editează partener" : "Partener nou"}
                </h2>
                <div className="flex items-center gap-2">
                  <SaveButton
                    label={partner ? "Salvează" : "Adaugă"}
                    pending={pending}
                    onClick={() => formRef.current?.requestSubmit()}
                  />
                  <CloseIconButton onClick={() => setOpen(false)} />
                </div>
              </div>

              <DrawerModalScope>
              <form
                ref={formRef}
                onSubmit={onSubmit}
                className="grid gap-4 px-5 py-4"
                onKeyDown={(event) => handleEnterNavigation(event)}
              >
                {partner ? (
                  <input name="partnerId" type="hidden" value={partner.id} />
                ) : null}

                <DrawerCard icon={UserRound} title="Contact">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field className="lg:col-span-2" label="Nume">
                  <input
                    className={inputClassName}
                    name="name"
                    defaultValue={partner?.name ?? initialName ?? ""}
                    placeholder="ex. Auto Parts SRL"
                    required
                  />
                </Field>
                <Field label="Tip partener">
                  <select
                    className={inputClassName}
                    name="kind"
                    defaultValue={partner?.kind ?? defaultKind ?? "SUPPLIER"}
                  >
                    {KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Discount client (%)">
                  <input
                    className={inputClassName}
                    name="discountPercent"
                    defaultValue={partner?.discountPercent ?? ""}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </Field>
                <Field className="sm:col-span-1 lg:col-span-2" label="Telefon">
                  <input
                    className={inputClassName}
                    name="phone"
                    defaultValue={partner?.phone ?? ""}
                    inputMode="tel"
                    placeholder="ex. 0760 123 456"
                  />
                </Field>
                <Field className="sm:col-span-1 lg:col-span-2" label="E-mail">
                  <input
                    className={inputClassName}
                    name="email"
                    defaultValue={partner?.email ?? ""}
                    inputMode="email"
                    placeholder="ex. contabilitate@firma.md"
                    type="email"
                  />
                </Field>
                </div>
                </DrawerCard>

                {/* Datele de facturare sunt cerute de proforme și e-Factura;
                    la o persoană fizică pot rămâne goale. */}
                <DrawerCard icon={Landmark} title="Date pentru factură">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="IDNO / Cod fiscal">
                  <input
                    className={inputClassName}
                    name="idno"
                    defaultValue={partner?.idno ?? ""}
                    inputMode="numeric"
                    placeholder="ex. 1006600052073"
                    onChange={(event) => setIdno(event.currentTarget.value)}
                  />
                  {idnoProblem ? <span className="text-xs font-medium text-(--c-amber)">{idnoProblem}</span> : null}
                </Field>
                <Field label="Cod TVA">
                  <input
                    className={inputClassName}
                    name="vatCode"
                    defaultValue={partner?.vatCode ?? ""}
                    inputMode="numeric"
                    placeholder="opțional"
                  />
                </Field>
                <Field className="sm:col-span-2" label="Adresa juridică">
                  <input
                    className={inputClassName}
                    name="address"
                    defaultValue={partner?.address ?? ""}
                    placeholder="mun. Chișinău, str. ..."
                  />
                </Field>
                <Field className="sm:col-span-2" label="IBAN">
                  <input
                    className={`${inputClassName} font-mono`}
                    name="iban"
                    defaultValue={partner?.iban ?? ""}
                    placeholder="MD..."
                    onChange={(event) => setIban(event.currentTarget.value)}
                  />
                  {ibanProblem ? <span className="text-xs font-medium text-(--c-amber)">{ibanProblem}</span> : null}
                </Field>
                <Field label="Banca">
                  <input
                    className={inputClassName}
                    name="bankName"
                    defaultValue={partner?.bankName ?? ""}
                    placeholder="Denumirea băncii"
                  />
                </Field>
                <Field label="Cod bancar / BIC">
                  <input
                    className={inputClassName}
                    name="bankCode"
                    defaultValue={partner?.bankCode ?? ""}
                    placeholder="ex. MOBBMD22"
                  />
                </Field>
                </div>
                </DrawerCard>

                <Field label="Note">
                  <textarea
                    className={`${inputClassName} min-h-14 resize-y py-2`}
                    name="notes"
                    defaultValue={partner?.notes ?? ""}
                    placeholder="Observații, condiții de livrare etc."
                  />
                </Field>
              </form>
              </DrawerModalScope>
            </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
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
    <label className={`grid content-start gap-1 text-[13px] font-medium text-(--c-muted) ${className}`}>
      {label}
      {children}
    </label>
  );
}


const inputClassName =
  "field-control h-9 w-full rounded-md border border-(--c-line) bg-(--c-surface) px-2.5 text-sm outline-none placeholder:text-(--c-muted-2) disabled:bg-(--c-line-2)";
