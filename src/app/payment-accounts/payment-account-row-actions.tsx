"use client";

import { FileCode2, FileText, Send } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import {
  cancelPaymentAccountAction,
  fulfillPaymentAccountAction,
  markPaymentAccountPaidAction,
  submitPaymentAccountToEFacturaAction,
  type PaymentAccountActionState,
} from "@/app/payment-accounts/actions";
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
}: {
  id: string;
  number: number;
  paid: boolean;
  fulfilled: boolean;
  cancelled: boolean;
  canSubmitEFactura: boolean;
  eFacturaStatus: EFacturaSubmissionStatus;
  eFacturaMessage: string | null;
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
      {canSubmitEFactura && fulfilled && !cancelled && eFacturaStatus !== "SUBMITTED" ? (
        <ActionForm
          action={submitPaymentAccountToEFacturaAction}
          confirmText={`Trimiți contul #${number} nesemnat către SIA e-Factura? După transmitere trebuie semnat în portal.`}
          icon={<Send className="size-3.5" aria-hidden="true" />}
          id={id}
          label={eFacturaStatus === "ERROR" ? "Reîncearcă e-Factura" : "Trimite în e-Factura"}
        />
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
          confirmText={`Anulezi contul de plată #${number}?`}
          danger
          id={id}
          label="Anulează"
        />
      ) : null}
      {fulfilled && eFacturaStatus !== "NOT_SENT" ? (
        <span
          className={`basis-full pt-1 text-right text-[11px] ${eFacturaStatus === "SUBMITTED" ? "text-[#166534]" : "text-[#b91c1c]"}`}
          title={eFacturaMessage ?? undefined}
        >
          {eFacturaStatus === "SUBMITTED" ? "● Trimis în e-Factura · necesită semnare" : `● Eroare e-Factura${eFacturaMessage ? `: ${eFacturaMessage}` : ""}`}
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
}: {
  action: Action;
  id: string;
  label: string;
  confirmText?: string;
  primary?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialState);
  useEffect(() => {
    if (state.message) window.alert(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      <input name="paymentAccountId" type="hidden" value={id} />
      <ActionButton danger={danger} icon={icon} label={label} primary={primary} />
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
