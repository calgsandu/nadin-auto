"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { saveAccountAction, type MoneyActionState } from "@/app/money/actions";
import {
  DrawerCard,
  DrawerField,
  OperationDrawer,
  useDrawerAction,
  drawerFormClassName,
  drawerInputClassName,
} from "@/app/components/operation-drawer";

const initial: MoneyActionState = { ok: false, message: "" };

export type AccountFormValue = {
  id: string;
  name: string;
  kind: "CASH" | "BANK";
  openingBalanceLei: number;
  openingDate: string;
  iban: string;
};

/** Contul de bani: soldul de la care pornește numărătoarea și ziua lui. */
export function AccountDialog({ account }: { account?: AccountFormValue }) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(account?.id);
  const { pending, onSubmit } = useDrawerAction(saveAccountAction, initial, () => setOpen(false));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
      >
        {editing ? "Editează contul" : "Cont nou"}
      </button>
      {open ? (
        <OperationDrawer
          title={editing ? account!.name : "Cont nou"}
          icon={Landmark}
          open={open}
          pending={pending}
          submitLabel="Salvează contul"
          onClose={() => setOpen(false)}
        >
          <form onSubmit={onSubmit} className={drawerFormClassName}>
            {account?.id ? <input name="accountId" type="hidden" value={account.id} /> : null}

            <DrawerCard icon={Landmark} title="Cont">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DrawerField label="Nume">
                  <input
                    autoFocus
                    className={drawerInputClassName}
                    defaultValue={account?.name ?? ""}
                    name="name"
                    placeholder="Casa, Cont curent MAIB"
                    required
                  />
                </DrawerField>
                <DrawerField label="Fel">
                  <select className={drawerInputClassName} defaultValue={account?.kind ?? "CASH"} name="kind">
                    <option value="CASH">Casă (numerar)</option>
                    <option value="BANK">Cont bancar</option>
                  </select>
                </DrawerField>
                <DrawerField label="Sold de pornire (lei)">
                  <input
                    className={drawerInputClassName}
                    defaultValue={account?.openingBalanceLei ?? 0}
                    inputMode="decimal"
                    name="openingBalanceLei"
                    step="0.01"
                    type="number"
                  />
                </DrawerField>
                {/* Mișcările dinaintea datei nu se mai adună: sunt deja în soldul de pornire. */}
                <DrawerField label="Soldul e de la data">
                  <input
                    className={drawerInputClassName}
                    defaultValue={account?.openingDate ?? ""}
                    name="openingDate"
                    required
                    type="date"
                  />
                </DrawerField>
                <div className="md:col-span-2">
                  <DrawerField label="IBAN (doar conturi bancare)">
                    <input className={drawerInputClassName} defaultValue={account?.iban ?? ""} name="iban" />
                  </DrawerField>
                </div>
              </div>
            </DrawerCard>
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
