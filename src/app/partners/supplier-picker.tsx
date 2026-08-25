"use client";

import { useState } from "react";
import { PartnerFormDialog } from "@/app/partners/partner-form-dialog";
import { useOptimisticOptions } from "@/app/components/use-optimistic-options";

/**
 * Selectul de furnizor cu ieșire spre formularul de partener.
 *
 * Înainte, un furnizor nou însemna: abandonezi recepția, mergi la Furnizori,
 * îl creezi, te întorci. Mai rău, cu lista goală selectul era DEZACTIVAT — nu
 * exista nicio cale de ieșire din ecranul acela.
 *
 * Furnizorul creat intră optimist în listă și rămâne ales pe loc.
 */
export function SupplierPicker({
  name,
  suppliers,
  className,
  defaultValue = "",
  value,
  onChange,
  emptyLabel = "Alege furnizorul",
  noneLabel,
}: {
  name: string;
  suppliers: readonly { id: string; name: string }[];
  className: string;
  /** Pentru selectele necontrolate (recepție, editare document, comandă externă). */
  defaultValue?: string;
  /** Dat = selectul e controlat de părinte (rândurile externe de la vânzare). */
  value?: string;
  onChange?: (supplierId: string) => void;
  emptyLabel?: string;
  /** Textul opțiunii goale când furnizorul chiar poate lipsi („Fără furnizor"). */
  noneLabel?: string;
}) {
  const { options, add } = useOptimisticOptions(suppliers);
  const controlled = value !== undefined;
  const [selfValue, setSelfValue] = useState(defaultValue);
  const [creating, setCreating] = useState(false);
  const current = controlled ? value : selfValue;

  function select(next: string) {
    if (!controlled) setSelfValue(next);
    onChange?.(next);
  }

  return (
    <div className="grid gap-2">
      <select
        className={className}
        name={name}
        value={current}
        onChange={(event) => select(event.currentTarget.value)}
      >
        <option value="">
          {noneLabel ?? (options.length > 0 ? emptyLabel : "Niciun furnizor încă")}
        </option>
        {options.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
      <button
        className="button-secondary justify-self-start rounded-md border border-[#e8e7e3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
        type="button"
        onClick={() => setCreating(true)}
      >
        Furnizor nou
      </button>

      <PartnerFormDialog
        defaultKind="SUPPLIER"
        open={creating}
        onOpenChange={setCreating}
        onCreated={(partner) => {
          add(partner);
          select(partner.id);
        }}
      />
    </div>
  );
}
