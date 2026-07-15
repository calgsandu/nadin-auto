import type { PartnerKind } from "@/generated/prisma/enums";

const PARTNER_KINDS: readonly PartnerKind[] = ["SUPPLIER", "CUSTOMER", "BOTH"];

export type PartnerInput = {
  name: string;
  kind: PartnerKind;
  phone: string | null;
  email: string | null;
  address: string | null;
  idno: string | null;
  vatCode: string | null;
  iban: string | null;
  bankName: string | null;
  bankCode: string | null;
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
  const email = readString(formData, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Adresa de e-mail nu este validă." };
  }

  const address = readString(formData, "address");
  const idno = readString(formData, "idno");
  if (idno && !/^\d{7,13}$/.test(idno)) {
    return { ok: false, message: "IDNO trebuie să conțină între 7 și 13 cifre." };
  }

  const vatCode = readString(formData, "vatCode");
  const iban = readString(formData, "iban").replace(/\s+/g, "").toUpperCase();
  if (iban && !/^[A-Z]{2}[A-Z0-9]{13,32}$/.test(iban)) {
    return { ok: false, message: "IBAN-ul nu este valid." };
  }

  const bankName = readString(formData, "bankName");
  const bankCode = readString(formData, "bankCode").replace(/\s+/g, "").toUpperCase();
  const notes = readString(formData, "notes");

  return {
    ok: true,
    data: {
      name,
      kind: kindRaw as PartnerKind,
      phone: phone || null,
      email: email || null,
      address: address || null,
      idno: idno || null,
      vatCode: vatCode || null,
      iban: iban || null,
      bankName: bankName || null,
      bankCode: bankCode || null,
      notes: notes || null,
    },
  };
}
