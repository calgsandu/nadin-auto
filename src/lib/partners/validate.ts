import type { PartnerKind } from "@/generated/prisma/enums";

const PARTNER_KINDS: readonly PartnerKind[] = ["SUPPLIER", "CUSTOMER", "BOTH"];

export type PartnerInput = {
  name: string;
  kind: PartnerKind;
  phone: string | null;
  notes: string | null;
};

export type PartnerParseResult =
  | { ok: true; data: PartnerInput }
  | { ok: false; message: string };

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parsePartnerForm(formData: FormData): PartnerParseResult {
  const name = readString(formData, "name");
  if (!name) return { ok: false, message: "Numele furnizorului este obligatoriu." };

  const kindRaw = readString(formData, "kind") || "SUPPLIER";
  if (!PARTNER_KINDS.includes(kindRaw as PartnerKind)) {
    return { ok: false, message: "Tip de partener invalid." };
  }

  const phone = readString(formData, "phone");
  const notes = readString(formData, "notes");

  return {
    ok: true,
    data: {
      name,
      kind: kindRaw as PartnerKind,
      phone: phone || null,
      notes: notes || null,
    },
  };
}
