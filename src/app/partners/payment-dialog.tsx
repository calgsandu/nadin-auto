"use client";

import { useMemo, useState } from "react";
import {
  registerPartnerPaymentAction,
  type PartnerActionState,
} from "@/app/partners/actions";
import {
  DrawerField,
  DrawerFooter,
  OperationDrawer,
  useDrawerAction,
  drawerFormClassName,
  drawerInputClassName,
} from "@/app/components/operation-drawer";
import { useDrawerDraft } from "@/app/components/use-drawer-draft";
import { formatDateInputValue } from "@/lib/operations/date-input";

const initial: PartnerActionState = { ok: false, message: "" };

/** Încasare de la un client cu datorie („Долг" din 1C). */
export function PartnerPaymentDialog({
  partnerId,
  partnerName,
  balanceLei,
}: {
  partnerId: string;
  partnerName: string;
  balanceLei: number;
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  // Încasarea n-are state controlat: ciorna e formată doar din câmpuri.
  const draft = useDrawerDraft({
    kind: `partner-payment:${partnerId}`,
    lines: null,
    setLines: () => {},
    reset: () => {},
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(
    registerPartnerPaymentAction,
    initial,
    () => {
      setOpen(false);
      setMounted(false);
      draft.clear();
    },
  );
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className="button-secondary button-icon-cash inline-flex items-center gap-1.5 rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
      >
        Încasează
      </button>
      {mounted ? (
        <OperationDrawer
          title={`Încasare — ${partnerName}`}
          open={open}
          pending={pending}
          submitLabel="Salvează încasarea"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName}>
            <input type="hidden" name="partnerId" value={partnerId} />
            <input name="idempotencyKey" type="hidden" value={draft.token} />
            <div className="grid gap-4 md:grid-cols-2">
              <DrawerField label="Suma încasată (lei)" hint={`Datorie curentă: ${balanceLei.toFixed(2)} lei`}>
                <input
                  autoFocus
                  className={drawerInputClassName}
                  defaultValue={balanceLei > 0 ? balanceLei.toFixed(2) : ""}
                  inputMode="decimal"
                  min={0.01}
                  name="amount"
                  required
                  step="0.01"
                  type="number"
                />
              </DrawerField>
              <DrawerField label="Data încasării">
                <input className={drawerInputClassName} defaultValue={today} name="paidAt" type="date" />
              </DrawerField>
            </div>
            <DrawerField label="Notițe">
              <textarea
                className={`${drawerInputClassName} min-h-16 resize-y py-2`}
                name="notes"
                placeholder="numerar, transfer, cine a predat banii"
              />
            </DrawerField>
            <DrawerFooter onCancel={() => setOpen(false)} pending={pending} submitLabel="Salvează încasarea" />
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
