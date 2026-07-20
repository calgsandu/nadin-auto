export type CashRegisterStatus = boolean | null;

export function parseRequiredCashRegistered(value: string): boolean {
  if (value === "yes") return true;
  if (value === "no") return false;
  throw new Error("Alege dacă vânzarea a fost bătută în casă.");
}

export function parseOptionalCashRegistered(
  value: string,
): CashRegisterStatus {
  if (value === "unspecified") return null;
  if (value === "yes") return true;
  if (value === "no") return false;
  throw new Error("Statut de casă invalid.");
}

export function cashRegisterLabel(value: CashRegisterStatus) {
  if (value === true) return "Bătut în casă";
  if (value === false) return "Nebătut în casă";
  return "Nespecificat";
}

export function cashRegisterFormValue(value: CashRegisterStatus) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unspecified";
}

export function assertCashRegisterDocumentType(type: string) {
  if (type !== "SALE") {
    throw new Error("Statutul de casă este disponibil doar pentru vânzări.");
  }
}
