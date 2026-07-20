"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteProductAction, type CatalogActionState } from "@/app/catalog/actions";
import { ActionFeedback } from "@/app/components/action-feedback";

const initialState: CatalogActionState = { ok: false, message: "" };

export function ProductDeleteButton({ productId, label }: { productId: string; label: string }) {
  const [state, formAction] = useActionState(deleteProductAction, initialState);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(e) => {
        if (!window.confirm(`Ștergi produsul „${label}”?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <DeleteButton />
      <ActionFeedback state={state} compact />
    </form>
  );
}

function DeleteButton() {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="button-secondary rounded-md border border-[#fca5a5] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-60"
    >
      {status.pending ? "..." : "Șterge"}
    </button>
  );
}
