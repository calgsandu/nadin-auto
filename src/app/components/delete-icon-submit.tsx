"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Trash2 } from "lucide-react";
import { IconLabel, rowDangerIconButtonCls } from "@/app/components/icon-buttons";

/** Butonul „Șterge" al unui formular de ștergere: doar coșul, roșu. */
export function DeleteIconSubmit() {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} title="Șterge" className={rowDangerIconButtonCls}>
      {status.pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
      <IconLabel>{status.pending ? "Se șterge..." : "Șterge"}</IconLabel>
    </button>
  );
}
