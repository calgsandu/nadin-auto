/**
 * CREDIT = marfă predată fără încasare; TRANSFER = plătită prin bancă, cu
 * încasarea scrisă separat (PartnerPayment). Amândouă intră în datoria
 * clientului până la încasare; niciuna nu ajunge în casa de marcat.
 */
export type SalePaymentMethodValue = "CASH" | "CARD" | "CREDIT" | "TRANSFER";
export type SalePaymentMethodStatus = SalePaymentMethodValue | null;

export function parseRequiredSalePaymentMethod(
  value: string,
): SalePaymentMethodValue {
  if (value === "cash") return "CASH";
  if (value === "card") return "CARD";
  if (value === "credit") return "CREDIT";
  if (value === "transfer") return "TRANSFER";
  throw new Error("Alege metoda de plată: Cash, Card, Pe datorie sau Transfer.");
}

export function parseOptionalSalePaymentMethod(
  value: string,
): SalePaymentMethodStatus {
  if (value === "unspecified") return null;
  if (value === "cash") return "CASH";
  if (value === "card") return "CARD";
  if (value === "credit") return "CREDIT";
  if (value === "transfer") return "TRANSFER";
  throw new Error("Metodă de plată invalidă.");
}

export function salePaymentMethodLabel(value: SalePaymentMethodStatus) {
  if (value === "CASH") return "Cash";
  if (value === "CARD") return "Card";
  if (value === "CREDIT") return "Pe datorie";
  if (value === "TRANSFER") return "Transfer bancar";
  return "Nespecificat";
}

export function salePaymentMethodFormValue(value: SalePaymentMethodStatus) {
  if (value === "CASH") return "cash";
  if (value === "CARD") return "card";
  if (value === "CREDIT") return "credit";
  if (value === "TRANSFER") return "transfer";
  return "unspecified";
}

export function assertSalePaymentMethodDocumentType(type: string) {
  if (type !== "SALE") {
    throw new Error("Metoda de plată este disponibilă doar pentru vânzări.");
  }
}
