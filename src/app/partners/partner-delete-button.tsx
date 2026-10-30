"use client";

import { useActionState } from "react";
import {
  deletePartnerAction,
  type PartnerActionState,
} from "@/app/partners/actions";
import { ActionFeedback } from "@/app/components/action-feedback";
import { DeleteIconSubmit } from "@/app/components/delete-icon-submit";

const initialState: PartnerActionState = { ok: false, message: "" };

export function PartnerDeleteButton({
  partnerId,
  partnerName,
}: {
  partnerId: string;
  partnerName: string;
}) {
  const [state, formAction] = useActionState(deletePartnerAction, initialState);

  return (
    <form
      action={formAction}
      className="grid justify-items-end gap-1"
      onSubmit={(event) => {
        if (!window.confirm(`Ștergi partenerul "${partnerName}"?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="partnerId" type="hidden" value={partnerId} />
      <DeleteIconSubmit />
      <ActionFeedback state={state} />
    </form>
  );
}

