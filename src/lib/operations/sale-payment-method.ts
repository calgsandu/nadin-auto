/** CREDIT = marfă predată fără încasare; intră în datoria clientului. */
export type SalePaymentMethodValue = "CASH" | "CARD" | "CREDIT";
export type SalePaymentMethodStatus = SalePaymentMethodValue | null;

export function parseRequiredSalePaymentMethod(
  value: string,
): SalePaymentMethodValue {
  if (value === "cash") return "CASH";
  if (value === "card") return "CARD";
  if (value === "credit") return "CREDIT";
  throw new Error("Alege metoda de plată: Cash, Card sau Pe datorie.");
}

export function parseOptionalSalePaymentMethod(
  value: string,
): SalePaymentMethodStatus {
  if (value === "unspecified") return null;
  if (value === "cash") return "CASH";
  if (value === "card") return "CARD";
  if (value === "credit") return "CREDIT";
  throw new Error("Metodă de plată invalidă.");
}

export function salePaymentMethodLabel(value: SalePaymentMethodStatus) {
  if (value === "CASH") return "Cash";
  if (value === "CARD") return "Card";
  if (value === "CREDIT") return "Pe datorie";
  return "Nespecificat";
}

export function salePaymentMethodFormValue(value: SalePaymentMethodStatus) {
  if (value === "CASH") return "cash";
  if (value === "CARD") return "card";
  if (value === "CREDIT") return "credit";
  return "unspecified";
}

export function assertSalePaymentMethodDocumentType(type: string) {
  if (type !== "SALE") {
    throw new Error("Metoda de plată este disponibilă doar pentru vânzări.");
  }
}
