"use client";

import { FileCode2, FileText, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ActionFeedback } from "@/app/components/action-feedback";
import {
  cancelPaymentAccountAction,
  fulfillPaymentAccountAction,
  markPaymentAccountPaidAction,
  submitPaymentAccountToEFacturaAction,
  updatePaymentAccountAction,
  type PaymentAccountActionState,
} from "@/app/payment-accounts/actions";
import {
  DrawerField,
  DrawerFooter,
  OperationDrawer,
  drawerFormClassName,
  drawerInputClassName,
  useDrawerAction,
} from "@/app/components/operation-drawer";
import type { EFacturaSubmissionStatus } from "@/generated/prisma/enums";

const initialState: PaymentAccountActionState = { ok: false, message: "" };
type Action = (
  state: PaymentAccountActionState,
  formData: FormData,
) => Promise<PaymentAccountActionState>;

export function PaymentAccountRowActions({
  id,
  number,
  paid,
  fulfilled,
  cancelled,
  canSubmitEFactura,
  eFacturaStatus,
  eFacturaMessage,
  eFacturaResponseCode,
  dueDate,
  notes,
}: {
  id: string;
  number: number;
  paid: boolean;
  fulfilled: boolean;
  cancelled: boolean;
  canSubmitEFactura: boolean;
  eFacturaStatus: EFacturaSubmissionStatus;
  eFacturaMessage: string | null;
  /** Statutul numeric de la SIA; se scria și nu se citea nicăieri. */
  eFacturaResponseCode: number | null;
  /** YYYY-MM-DD, pentru corectare. */
  dueDate: string;
  notes: string;
}) {
  return (
    <div className="flex max-w-md flex-wrap justify-end gap-1.5">
      <a
        className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-xs font-semibold"
        href={`/api/export/payment-account/${id}/pdf`}
      >
        <FileText className="size-3.5" aria-hidden="true" /> PDF
      </a>
      {fulfilled && !cancelled ? (
        <a
          className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-xs font-semibold"
          href={`/api/export/payment-account/${id}/efactura-xml`}
        >
          <FileCode2 className="size-3.5" aria-hidden="true" /> XML fiscal
        </a>
      ) : null}
      {canSubmitEFactura &&
      fulfilled &&
      !cancelled &&
      eFacturaStatus !== "SUBMITTED" &&
      eFacturaStatus !== "PROCESSED" ? (
        <ActionForm
          action={submitPaymentAccountToEFacturaAction}
          confirmText={`Trimiți contul #${number} nesemnat către SIA e-Factura? După transmitere trebuie semnat în portal.`}
          icon={<Send className="size-3.5" aria-hidden="true" />}
          id={id}
          label={eFacturaStatus === "ERROR" ? "Reîncearcă e-Factura" : "Trimite în e-Factura"}
        />
      ) : null}
      {!cancelled && !fulfilled ? (
        <CorrectionForm dueDate={dueDate} id={id} notes={notes} number={number} />
      ) : null}
      {!cancelled && !paid ? (
        <ActionForm action={markPaymentAccountPaidAction} id={id} label="Marchează achitat" />
      ) : null}
      {!cancelled && !fulfilled ? (
        <ActionForm
          action={fulfillPaymentAccountAction}
          confirmText={`Predai marfa pentru contul #${number}? Stocul va fi scăzut și se va crea vânzarea.`}
          id={id}
          label="Predă marfa"
          primary
        />
      ) : null}
      {!cancelled && !fulfilled ? (
        <ActionForm
          action={cancelPaymentAccountAction}
          confirmText={
            paid
              ? `Contul #${number} este achitat. Anularea înregistrează și rambursarea banilor către client. Continui?`
              : `Anulezi contul de plată #${number}?`
          }
          danger
          // Contul achitat se poate anula doar împreună cu restituirea banilor.
          extraFields={paid ? { refund: "1" } : undefined}
          id={id}
          label={paid ? "Anulează și rambursează" : "Anulează"}
        />
      ) : null}
      {fulfilled && eFacturaStatus !== "NOT_SENT" ? (
        <span
          className={`basis-full pt-1 text-right text-[11px] ${
            eFacturaStatus === "ERROR" ? "text-[#b91c1c]" : "text-[#166534]"
          }`}
          title={[
            eFacturaMessage,
            eFacturaResponseCode != null ? `Statut SIA: ${eFacturaResponseCode}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {/* „Necesită semnare" era spus și pentru facturi doar acceptate spre
              execuție, care nici măcar nu fuseseră procesate. */}
          {eFacturaStatus === "PROCESSED"
            ? "Procesat de SIA — semnează în portal"
            : eFacturaStatus === "SUBMITTED"
              ? "Acceptat spre executare de SIA"
              : `Eroare e-Factura${eFacturaMessage ? `: ${eFacturaMessage}` : ""}`}
        </span>
      ) : null}
    </div>
  );
}

function ActionForm({
  action,
  id,
  label,
  confirmText,
  primary = false,
  danger = false,
  icon,
  extraFields,
}: {
  action: Action;
  id: string;
  label: string;
  confirmText?: string;
  primary?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
  extraFields?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <input name="paymentAccountId" type="hidden" value={id} />
      {Object.entries(extraFields ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <ActionButton danger={danger} icon={icon} label={label} primary={primary} />
      <ActionFeedback state={state} />
    </form>
  );
}

function ActionButton({
  label,
  primary,
  danger,
  icon,
}: {
  label: string;
  primary: boolean;
  danger: boolean;
  icon?: React.ReactNode;
}) {
  const status = useFormStatus();
  const colors = primary
    ? "border-[#1b1a17] bg-[#1b1a17] text-white"
    : danger
      ? "border-[#fca5a5] bg-white text-[#b91c1c]"
      : "border-[#e8e7e3] bg-white text-[#1b1a17]";
  return (
    <button className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-60 ${colors}`} disabled={status.pending} type="submit">
      {status.pending ? "Se procesează..." : <>{icon}{label}</>}
    </button>
  );
}

/**
 * Corectarea contului emis: scadența, observațiile și — mai ales — datele
 * clientului, luate din nou de la partener. Un IDNO greșit se repară în fișa
 * partenerului, apoi se apasă aici; contul e documentul pe care pleacă factura.
 */
function CorrectionForm({
  id,
  number,
  dueDate,
  notes,
}: {
  id: string;
  number: number;
  dueDate: string;
  notes: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { pending, onSubmit } = useDrawerAction(
    updatePaymentAccountAction,
    initialState,
    () => {
      setOpen(false);
      setMounted(false);
    },
  );

  if (open && !mounted) setMounted(true);

  return (
    <>
      <button
        className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-xs font-semibold text-[#1b1a17]"
        type="button"
        onClick={() => setOpen(true)}
      >
        Corectează
      </button>
      {mounted ? (
        <OperationDrawer
          open={open}
          title={`Corectează contul #${number}`}
          onClose={() => setOpen(false)}
        >
          <form className={drawerFormClassName} onSubmit={onSubmit}>
            <input name="paymentAccountId" type="hidden" value={id} />
            <DrawerField
              label="Datele clientului"
              hint="Se iau din nou din fișa partenerului la salvare. Corectează întâi acolo IDNO-ul sau adresa."
            >
              <p className="text-sm text-[#6f6b63]">
                Numele, IDNO-ul, adresa, TVA-ul și datele bancare se resincronizează.
              </p>
            </DrawerField>
            <DrawerField label="Scadența">
              <input
                className={drawerInputClassName}
                defaultValue={dueDate}
                name="dueDate"
                type="date"
              />
            </DrawerField>
            <DrawerField label="Observații">
              <textarea
                className={`${drawerInputClassName} min-h-24 resize-y py-3`}
                defaultValue={notes}
                name="notes"
              />
            </DrawerField>
            <DrawerFooter
              pending={pending}
              submitLabel="Salvează corectura"
              onCancel={() => setOpen(false)}
            />
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
