"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteExternalOrderAction,
  setExternalOrderStatusAction,
  type ExternalOrderActionState,
} from "@/app/external-orders/actions";
import { ActionFeedback } from "@/app/components/action-feedback";
import {
  DrawerField,
  DrawerFooter,
  DrawerMessage,
  OperationDrawer,
  drawerFormClassName,
  drawerInputClassName,
  useDrawerAction,
} from "@/app/components/operation-drawer";
import { NEXT_STATUS, STATUS_LABELS } from "@/lib/external-orders/status";
import type { ExternalOrderStatus } from "@/generated/prisma/enums";

const initialState: ExternalOrderActionState = { ok: false, message: "" };

/** Butoane de avans în flux: statusul următor + Anulează. */
export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: ExternalOrderStatus;
}) {
  const [state, formAction] = useActionState(setExternalOrderStatusAction, initialState);
  const nextStatuses = NEXT_STATUS[status];
  if (nextStatuses.length === 0) return null;

  // Livrarea creează vânzarea, deci are nevoie de metoda de plată: nu mai poate
  // fi un simplu buton de avans în flux.
  const quickStatuses = nextStatuses.filter((next) => next !== "LIVRAT");

  return (
    <div className="grid justify-items-end gap-1">
      {nextStatuses.includes("LIVRAT") ? <DeliverControl orderId={orderId} /> : null}
      {quickStatuses.length > 0 ? (
        <form action={formAction} className="grid justify-items-end gap-1">
          <input name="orderId" type="hidden" value={orderId} />
          <div className="flex flex-wrap justify-end gap-1.5">
            {quickStatuses.map((next) => (
              <StatusButton key={next} status={next} />
            ))}
          </div>
          <ActionFeedback state={state} compact />
        </form>
      ) : null}
    </div>
  );
}

/**
 * Livrarea unei comenzi externe: scrie vânzarea, deci întreabă cum s-a plătit.
 * Fără metodă, vânzarea ar cădea în „Nespecificat" la închiderea de zi și n-ar
 * intra în datoria clientului.
 */
function DeliverControl({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { state, pending, onSubmit, retry } = useDrawerAction(
    setExternalOrderStatusAction,
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
        className="button-primary rounded-md bg-[#1b1a17] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#33312c]"
        type="button"
        onClick={() => setOpen(true)}
      >
        Livrează
      </button>
      {mounted ? (
        <OperationDrawer
          open={open}
          size="narrow"
          title="Livrează comanda"
          onClose={() => setOpen(false)}
        >
          <form className={drawerFormClassName} onSubmit={onSubmit}>
            <input name="orderId" type="hidden" value={orderId} />
            <input name="status" type="hidden" value="LIVRAT" />
            <DrawerField
              label="Cum s-a plătit"
              hint="Livrarea creează vânzarea, care intră în închiderea de zi și în raportul de TVA."
            >
              <select className={drawerInputClassName} defaultValue="" name="paymentMethod" required>
                <option value="" disabled>Alege metoda de plată</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="credit">Pe datorie</option>
                <option value="transfer">Transfer bancar</option>
              </select>
            </DrawerField>
            <label className="flex items-center gap-2 text-sm font-medium text-[#33312c]">
              <input name="cashRegistered" type="checkbox" /> Bătută în casa de marcat
            </label>
            <DrawerMessage onRetry={retry} state={state} />
            <DrawerFooter
              pending={pending}
              submitLabel="Livrează"
              onCancel={() => setOpen(false)}
            />
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}

function StatusButton({ status }: { status: ExternalOrderStatus }) {
  const pending = useFormStatus().pending;
  const cancel = status === "ANULAT";
  return (
    <button
      className={`button-secondary rounded-md border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
        cancel
          ? "border-[#fca5a5] text-[#b91c1c] hover:bg-[#fef2f2]"
          : "border-[#e8e7e3] text-[#1b1a17] hover:bg-[#f6f6f4]"
      }`}
      disabled={pending}
      name="status"
      value={status}
      type="submit"
    >
      {pending ? "..." : STATUS_LABELS[status]}
    </button>
  );
}

export function OrderDeleteButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: number;
}) {
  const [state, formAction] = useActionState(deleteExternalOrderAction, initialState);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(event) => {
        if (!window.confirm(`Ștergi comanda externă #${orderNumber}?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="orderId" type="hidden" value={orderId} />
      <DeleteButton />
      <ActionFeedback state={state} compact />
    </form>
  );
}

function DeleteButton() {
  const status = useFormStatus();
  return (
    <button
      className="button-secondary rounded-md border border-[#fca5a5] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "..." : "Șterge"}
    </button>
  );
}
