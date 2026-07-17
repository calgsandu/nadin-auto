export type SalePaymentMethodValue = "CASH" | "CARD";
export type SalePaymentMethodStatus = SalePaymentMethodValue | null;

export function parseRequiredSalePaymentMethod(
  value: string,
): SalePaymentMethodValue {
  if (value === "cash") return "CASH";
  if (value === "card") return "CARD";
  throw new Error("Alege metoda de plată: Cash sau Card.");
}

export function parseOptionalSalePaymentMethod(
  value: string,
): SalePaymentMethodStatus {
  if (value === "unspecified") return null;
  if (value === "cash") return "CASH";
  if (value === "card") return "CARD";
  throw new Error("Metodă de plată invalidă.");
}

export function salePaymentMethodLabel(value: SalePaymentMethodStatus) {
  if (value === "CASH") return "Cash";
  if (value === "CARD") return "Card";
  return "Nespecificat";
}

export function salePaymentMethodFormValue(value: SalePaymentMethodStatus) {
  if (value === "CASH") return "cash";
  if (value === "CARD") return "card";
  return "unspecified";
}

export function assertSalePaymentMethodDocumentType(type: string) {
  if (type !== "SALE") {
    throw new Error("Metoda de plată este disponibilă doar pentru vânzări.");
  }
}
