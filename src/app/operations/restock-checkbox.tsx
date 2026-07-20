"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  markRestockDeliveredAction,
  markRestockUnavailableAction,
  type OperationActionState,
} from "@/app/operations/actions";
import { ActionFeedback } from "@/app/components/action-feedback";

const initialState: OperationActionState = { ok: false, message: "" };

type RestockCheckboxProps = {
  productId: string;
  warehouseId: string;
  label: string;
  kind: "delivered" | "unavailable";
};

export function RestockCheckbox({
  productId,
  warehouseId,
  label,
  kind,
}: RestockCheckboxProps) {
  const action =
    kind === "delivered" ? markRestockDeliveredAction : markRestockUnavailableAction;
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="grid justify-items-end gap-1">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <CheckboxInput
        label={label}
        onChecked={() => {
          formRef.current?.requestSubmit();
        }}
      />
      <ActionFeedback state={state} compact />
    </form>
  );
}

function CheckboxInput({
  label,
  onChecked,
}: {
  label: string;
  onChecked: () => void;
}) {
  const status = useFormStatus();

  return (
    <label className="inline-flex items-center justify-end gap-2 text-xs font-semibold text-[#33312c]">
      <input
        aria-label={label}
        className="size-4 rounded border-[#98948b] accent-[#15803d]"
        disabled={status.pending}
        type="checkbox"
        onChange={(event) => {
          if (event.currentTarget.checked) {
            onChecked();
          }
        }}
      />
      {status.pending ? "..." : label}
    </label>
  );
}
