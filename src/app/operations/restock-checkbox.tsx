"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  markRestockDeliveredAction,
  markRestockUnavailableAction,
  type OperationActionState,
} from "@/app/operations/actions";

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

  useEffect(() => {
    if (state.message && !state.ok) {
      window.alert(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="warehouseId" value={warehouseId} />
      <CheckboxInput
        label={label}
        onChecked={() => {
          formRef.current?.requestSubmit();
        }}
      />
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
    <label className="inline-flex items-center justify-end gap-2 text-xs font-semibold text-[#2f3a34]">
      <input
        aria-label={label}
        className="size-4 rounded border-[#9c9385] accent-[#2f5d50]"
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
