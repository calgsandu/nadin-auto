"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ActionFeedback } from "@/app/components/action-feedback";
import { OperationDrawer } from "@/app/components/operation-drawer";
import {
  deletePartnerPaymentAction,
  type PartnerActionState,
} from "@/app/partners/actions";
import type { PartnerLedgerEntry } from "@/lib/partners/debt";

const initialState: PartnerActionState = { ok: false, message: "" };
const money = new Intl.NumberFormat("ro-MD", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const day = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type LedgerEntry = Omit<PartnerLedgerEntry, "date"> & { date: string };

/**
 * Fișa partenerului: din ce e făcut soldul.
 *
 * Coloana „Datorie" arăta o cifră fără nicio cale de a o urmări; aici sunt
 * mișcările care o compun, iar încasările tastate greșit se pot șterge.
 */
export function PartnerLedgerButton({
  partnerId,
  partnerName,
  balanceLei,
}: {
  partnerId: string;
  partnerName: string;
  balanceLei: number;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`/api/partners/${partnerId}/ledger`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ entries: LedgerEntry[] }>;
      })
      .then((data) => {
        if (alive) setEntries(data.entries);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open, partnerId]);

  return (
    <>
      <button
        className="button-secondary rounded-md border border-[#e8e7e3] px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
        type="button"
        onClick={() => {
          // Starea se curăță aici, nu în efect: o redeschidere după o eroare de
          // rețea trebuie să pornească din nou de la „se încarcă".
          setEntries(null);
          setFailed(false);
          setOpen(true);
        }}
      >
        Fișă
      </button>
      {open ? (
        <OperationDrawer
          title={`Fișa lui ${partnerName}`}
          onClose={() => setOpen(false)}
        >
          <div className="grid gap-4 px-6 py-6">
            <div className="flex items-baseline justify-between gap-4 rounded-md border border-[#e8e7e3] bg-white px-4 py-3">
              <span className="text-sm font-medium text-[#33312c]">Sold curent</span>
              <span
                className={`font-mono text-lg font-semibold ${
                  balanceLei > 0 ? "text-[#b91c1c]" : "text-[#166534]"
                }`}
              >
                {money.format(balanceLei)} lei
              </span>
            </div>

            {failed ? (
              <p className="text-sm text-[#b91c1c]">Fișa nu s-a putut încărca.</p>
            ) : entries === null ? (
              <p className="text-sm text-[#6f6b63]">Se încarcă...</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-[#6f6b63]">
                Nicio mișcare: partenerul n-are vânzări neîncasate și nici încasări.
              </p>
            ) : (
              <ul className="grid gap-2">
                {entries.map((entry) => (
                  <li
                    key={`${entry.kind}-${entry.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-[#efeeeb] bg-white px-3 py-2.5"
                  >
                    <span className="text-sm text-[#1b1a17]">{entry.label}</span>
                    <span className="text-xs text-[#6f6b63]">
                      {day.format(new Date(entry.date))}
                    </span>
                    <span
                      className={`ml-auto font-mono text-sm font-semibold ${
                        entry.amountLei > 0 ? "text-[#b91c1c]" : "text-[#166534]"
                      }`}
                    >
                      {entry.amountLei > 0 ? "+" : ""}
                      {money.format(entry.amountLei)}
                    </span>
                    {entry.kind === "PAYMENT" ? (
                      <DeletePayment
                        id={entry.id}
                        onDeleted={() =>
                          setEntries((current) =>
                            (current ?? []).filter((one) => one.id !== entry.id),
                          )
                        }
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </OperationDrawer>
      ) : null}
    </>
  );
}

function DeletePayment({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [state, formAction] = useActionState(deletePartnerPaymentAction, initialState);

  useEffect(() => {
    if (state.ok) onDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doar la trecerea în „șters"
  }, [state]);

  return (
    <form
      action={formAction}
      className="basis-full"
      onSubmit={(event) => {
        if (!window.confirm("Ștergi încasarea? Soldul partenerului se recalculează.")) {
          event.preventDefault();
        }
      }}
    >
      <input name="paymentId" type="hidden" value={id} />
      <DeleteButton />
      <ActionFeedback state={state} />
    </form>
  );
}

function DeleteButton() {
  const status = useFormStatus();
  return (
    <button
      className="text-xs font-semibold text-[#b91c1c] underline underline-offset-2 hover:no-underline disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Se șterge..." : "Șterge încasarea"}
    </button>
  );
}
