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
import type { MoneyAccountOption } from "@/lib/finance/expenses";

const initial: PartnerActionState = { ok: false, message: "" };

/**
 * Bani mișcați cu un partener: încasare de la un client cu datorie („Долг" din
 * 1C) sau plată către un furnizor căruia îi datorăm marfa recepționată.
 */
export function PartnerPaymentDialog({
  partnerId,
  partnerName,
  balanceLei,
  direction = "IN",
  accounts = [],
}: {
  partnerId: string;
  partnerName: string;
  balanceLei: number;
  /** IN = încasez de la client, OUT = plătesc furnizorului. */
  direction?: "IN" | "OUT";
  accounts?: MoneyAccountOption[];
}) {
  const outgoing = direction === "OUT";
  const noun = outgoing ? "Plată" : "Încasare";
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  // Încasarea n-are state controlat: ciorna e formată doar din câmpuri.
  const draft = useDrawerDraft({
    kind: `partner-payment:${direction}:${partnerId}`,
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
        title={outgoing ? "Plătește" : "Încasează"}
        className="button-secondary button-icon-cash relative inline-flex items-center gap-1.5 rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5] max-sm:size-8 max-sm:justify-center max-sm:px-0"
      >
        <span className="max-sm:sr-only">{outgoing ? "Plătește" : "Încasează"}</span>
      </button>
      {mounted ? (
        <OperationDrawer
          title={`${noun} — ${partnerName}`}
          icon={Wallet}
          open={open}
          pending={pending}
          submitLabel={outgoing ? "Salvează plata" : "Salvează încasarea"}
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName}>
            <input type="hidden" name="partnerId" value={partnerId} />
            <input type="hidden" name="direction" value={direction} />
            <input name="idempotencyKey" type="hidden" value={draft.token} />
            <DrawerCard icon={Wallet} title={`${outgoing ? "De plătit" : "Datorie"} ${money(balanceLei)} lei`}>
            <div className="grid gap-4 md:grid-cols-2">
              <DrawerField label={outgoing ? "Suma plătită (lei)" : "Suma încasată (lei)"}>
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
                {/* Ce rămâne după încasare sau plată, calculat pe loc. */}
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
              {/* Casa sau contul prin care au trecut banii — intră în registrul lui. */}
              {accounts.length > 0 ? (
                <DrawerField label={outgoing ? "Plătit din" : "Intrat în"}>
                  <select className={drawerInputClassName} defaultValue={accounts[0]?.id} name="accountId">
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </DrawerField>
              ) : null}
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
                placeholder={
                  outgoing ? "numărul facturii plătite, cine a dus banii" : "numerar, transfer, cine a predat banii"
                }
              />
            </details>
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
