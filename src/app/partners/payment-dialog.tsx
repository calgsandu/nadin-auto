"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import {
  registerPartnerPaymentAction,
  type PartnerActionState,
} from "@/app/partners/actions";
import {
  DrawerCard,
  DrawerField,
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
  const fullDebt = balanceLei > 0 ? balanceLei.toFixed(2) : "";
  // Doar pentru „rămâne de plată"; valoarea trimisă e cea din câmp.
  const [amount, setAmount] = useState(fullDebt);
  const amountRef = useRef<HTMLInputElement>(null);
  const left = Math.round((balanceLei - (Number(amount) || 0)) * 100) / 100;
  const money = (value: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(value);

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
          icon={Wallet}
          open={open}
          pending={pending}
          submitLabel="Salvează încasarea"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName}>
            <input type="hidden" name="partnerId" value={partnerId} />
            <input name="idempotencyKey" type="hidden" value={draft.token} />
            <DrawerCard icon={Wallet} title={`Datorie ${money(balanceLei)} lei`}>
            <div className="grid gap-4 md:grid-cols-2">
              <DrawerField label="Suma încasată (lei)">
                <div className="flex gap-2">
                  <input
                    ref={amountRef}
                    autoFocus
                    className={drawerInputClassName}
                    defaultValue={fullDebt}
                    inputMode="decimal"
                    min={0.01}
                    name="amount"
                    required
                    step="0.01"
                    type="number"
                    onChange={(event) => setAmount(event.currentTarget.value)}
                  />
                  {balanceLei > 0 ? (
                    <button
                      className="button-secondary shrink-0 whitespace-nowrap rounded-md border border-[#e4e4e7] bg-white px-3 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]"
                      type="button"
                      onClick={() => {
                        if (amountRef.current) amountRef.current.value = fullDebt;
                        setAmount(fullDebt);
                        amountRef.current?.focus();
                      }}
                    >
                      Toată datoria
                    </button>
                  ) : null}
                </div>
                {/* Ce rămâne după încasare, calculat pe loc. */}
                <span className={`text-xs ${left < 0 ? "font-medium text-[#b45309]" : "text-[#52525b]"}`}>
                  {left > 0
                    ? `rămâne de plată ${money(left)} lei`
                    : left === 0
                      ? "se achită toată"
                      : `cu ${money(-left)} lei mai mult decât datoria`}
                </span>
              </DrawerField>
              <DrawerField label="Data">
                <input className={drawerInputClassName} defaultValue={today} name="paidAt" type="date" />
              </DrawerField>
            </div>
            </DrawerCard>
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-[#52525b] hover:text-[#18181b] [&::-webkit-details-marker]:hidden">
                <Plus className="size-4 group-open:rotate-45" aria-hidden="true" /> Notițe
              </summary>
              <textarea
                aria-label="Notițe"
                className={`${drawerInputClassName} mt-2 min-h-16 resize-y py-2`}
                name="notes"
                placeholder="numerar, transfer, cine a predat banii"
              />
            </details>
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
