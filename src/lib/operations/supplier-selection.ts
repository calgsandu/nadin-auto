type SupplierKind = "SUPPLIER" | "BOTH" | "CUSTOMER";

export type SupplierPartner = {
  id: string;
  kind: SupplierKind;
};

export function normalizeOptionalPartnerId(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function ensureSupplierPartner(
  partner: SupplierPartner | null,
  selectedPartnerId: string | null,
) {
  if (!selectedPartnerId) {
    return null;
  }

  if (!partner) {
    throw new Error("Furnizorul ales nu există.");
  }

  if (partner.kind !== "SUPPLIER" && partner.kind !== "BOTH") {
    throw new Error("Partenerul ales nu este furnizor.");
  }

  return partner.id;
}
