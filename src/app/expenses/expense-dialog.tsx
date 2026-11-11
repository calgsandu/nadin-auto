"use client";

import { useMemo, useState } from "react";
import { HandCoins, Plus } from "lucide-react";
import {
  createExpenseAction,
  updateExpenseAction,
  type ExpenseActionState,
} from "@/app/expenses/actions";
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
import { EXPENSE_CATEGORIES } from "@/lib/finance/categories";
import type { MoneyAccountOption } from "@/lib/finance/expenses";
import type { ExpenseCategory } from "@/generated/prisma/enums";

const initial: ExpenseActionState = { ok: false, message: "" };

export type ExpenseDefaults = {
  id?: string;
  date?: string;
  category?: ExpenseCategory;
  amountLei?: number;
  description?: string;
  partnerId?: string | null;
  accountId?: string;
  notes?: string | null;
};

export function ExpenseDialog({
  accounts,
  partners,
  defaults,
  trigger,
  title,
}: {
  accounts: MoneyAccountOption[];
  partners: { id: string; name: string }[];
  /** Valorile de pornire: editare, sau o cheltuială copiată din luna trecută. */
  defaults?: ExpenseDefaults;
  trigger: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const editing = Boolean(defaults?.id);

  const draft = useDrawerDraft({
    kind: `expense:${defaults?.id ?? "new"}`,
    lines: null,
    setLines: () => {},
    reset: () => {},
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(
    editing ? updateExpenseAction : createExpenseAction,
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
        className={
          editing
            ? "button-secondary rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
            : "button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-[#18181b] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#27272a]"
        }
      >
        {trigger}
      </button>
      {mounted ? (
        <OperationDrawer
          title={title ?? (editing ? "Cheltuială, editare" : "Cheltuială nouă")}
          icon={HandCoins}
          open={open}
          pending={pending}
          submitLabel="Salvează cheltuiala"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName}>
            {defaults?.id ? <input type="hidden" name="expenseId" value={defaults.id} /> : null}
            <input name="idempotencyKey" type="hidden" value={draft.token} />

            <DrawerCard icon={HandCoins} title="Cheltuială">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="md:col-span-2">
                  <DrawerField label="Pentru ce s-au dat banii">
                    <input
                      autoFocus
                      className={drawerInputClassName}
                      defaultValue={defaults?.description ?? ""}
                      name="description"
                      placeholder="Chiria pe septembrie, motorină, hârtie de casă"
                      required
                    />
                  </DrawerField>
                </div>
                <DrawerField label="Suma (lei)">
                  <input
                    className={drawerInputClassName}
                    defaultValue={defaults?.amountLei ?? ""}
                    inputMode="decimal"
                    min={0.01}
                    name="amountLei"
                    required
                    step="0.01"
                    type="number"
                  />
                </DrawerField>
                <DrawerField label="Categorie">
                  <select
                    className={drawerInputClassName}
                    defaultValue={defaults?.category ?? "ALTELE"}
                    name="category"
                    required
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Data">
                  <input
                    className={drawerInputClassName}
                    defaultValue={defaults?.date ?? today}
                    name="date"
                    required
                    type="date"
                  />
                </DrawerField>
                <DrawerField label="Plătit din">
                  <select
                    className={drawerInputClassName}
                    defaultValue={defaults?.accountId ?? accounts[0]?.id}
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
                <div className="md:col-span-2">
                  <DrawerField label="Către cine (opțional)">
                    <select
                      className={drawerInputClassName}
                      defaultValue={defaults?.partnerId ?? ""}
                      name="partnerId"
                    >
                      <option value="">—</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                    </select>
                  </DrawerField>
                </div>
              </div>
            </DrawerCard>
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-[#52525b] hover:text-[#18181b] [&::-webkit-details-marker]:hidden">
                <Plus className="size-4 group-open:rotate-45" aria-hidden="true" /> Notițe
              </summary>
              <textarea
                aria-label="Notițe"
                className={`${drawerInputClassName} mt-2 min-h-16 resize-y py-2`}
                defaultValue={defaults?.notes ?? ""}
                name="notes"
                placeholder="numărul bonului, perioada acoperită, cine a plătit"
              />
            </details>
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
