"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Plus } from "lucide-react";
import { createMovementAction, type MoneyActionState } from "@/app/money/actions";
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
import { MOVEMENT_KINDS } from "@/lib/finance/movements";
import type { MoneyMovementKind } from "@/generated/prisma/enums";

const initial: MoneyActionState = { ok: false, message: "" };

/** Bani mișcați fără alt document: depunere, retragere, transfer. */
export function MovementDialog({
  accounts,
  defaultAccountId,
}: {
  accounts: { id: string; name: string }[];
  defaultAccountId?: string;
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const [kind, setKind] = useState<MoneyMovementKind>("DEPUNERE");

  const draft = useDrawerDraft({
    kind: "money-movement",
    lines: null,
    setLines: () => {},
    reset: () => {},
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(createMovementAction, initial, () => {
    setOpen(false);
    setMounted(false);
    draft.clear();
  });
  const today = useMemo(() => formatDateInputValue(new Date()), []);
  const selected = MOVEMENT_KINDS.find((one) => one.id === kind);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className="button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-[#18181b] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#27272a]"
      >
        Mișcare de bani
      </button>
      {mounted ? (
        <OperationDrawer
          title="Mișcare de bani"
          icon={ArrowRightLeft}
          open={open}
          pending={pending}
          submitLabel="Salvează mișcarea"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName}>
            <input name="idempotencyKey" type="hidden" value={draft.token} />

            <DrawerCard icon={ArrowRightLeft} title="Mișcare">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="md:col-span-2">
                  <DrawerField label="Ce fel de mișcare" hint={selected?.hint}>
                    <select
                      autoFocus
                      className={drawerInputClassName}
                      name="kind"
                      onChange={(event) => setKind(event.target.value as MoneyMovementKind)}
                      value={kind}
                    >
                      {MOVEMENT_KINDS.map((one) => (
                        <option key={one.id} value={one.id}>
                          {one.label}
                        </option>
                      ))}
                    </select>
                  </DrawerField>
                </div>
                <DrawerField label={kind === "TRANSFER" ? "Din contul" : "Contul"}>
                  <select
                    className={drawerInputClassName}
                    defaultValue={defaultAccountId ?? accounts[0]?.id}
                    name="accountId"
                    required
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </DrawerField>
                {kind === "TRANSFER" ? (
                  <DrawerField label="În contul">
                    <select className={drawerInputClassName} name="counterAccountId" required>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </DrawerField>
                ) : null}
                <DrawerField label="Suma (lei)">
                  <input
                    className={drawerInputClassName}
                    inputMode="decimal"
                    min={0.01}
                    name="amountLei"
                    required
                    step="0.01"
                    type="number"
                  />
                </DrawerField>
                <DrawerField label="Data">
                  <input
                    className={drawerInputClassName}
                    defaultValue={today}
                    name="date"
                    required
                    type="date"
                  />
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
                placeholder="de la cine, pentru ce, cine a dus banii"
              />
            </details>
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
