"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { deleteProductAction, type CatalogActionState } from "@/app/catalog/actions";

const initialState: CatalogActionState = { ok: false, message: "" };

export function ProductDeleteButton({ productId, label }: { productId: string; label: string }) {
  const [state, formAction] = useActionState(deleteProductAction, initialState);

  useEffect(() => {
    if (state.message && !state.ok) window.alert(state.message);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Ștergi produsul „${label}”?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <DeleteButton />
    </form>
  );
}

function DeleteButton() {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="button-secondary rounded-md border border-[#d6a28b] px-3 py-1.5 text-xs font-semibold text-[#7a2f13] hover:bg-[#fff1eb] disabled:opacity-60"
    >
      {status.pending ? "..." : "Șterge"}
    </button>
  );
}
