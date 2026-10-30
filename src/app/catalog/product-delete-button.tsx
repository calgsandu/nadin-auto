"use client";

import { useActionState } from "react";
import { deleteProductAction, type CatalogActionState } from "@/app/catalog/actions";
import { ActionFeedback } from "@/app/components/action-feedback";
import { DeleteIconSubmit } from "@/app/components/delete-icon-submit";

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
      <DeleteIconSubmit />
      <ActionFeedback state={state} />
    </form>
  );
}

