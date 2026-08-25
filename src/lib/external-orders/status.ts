import type { ExternalOrderStatus } from "@/generated/prisma/enums";

export const STATUS_LABELS: Record<ExternalOrderStatus, string> = {
  CERERE: "Cerere client",
  OFERTAT: "Ofertat",
  CONFIRMAT: "Comandat la furnizor",
  RECEPTIONAT: "Recepționat",
  LIVRAT: "Livrat",
  ANULAT: "Anulat",
};

/** Tranzițiile permise; ANULAT e permis din orice status ne-final. */
export const NEXT_STATUS: Record<ExternalOrderStatus, ExternalOrderStatus[]> = {
  CERERE: ["OFERTAT", "ANULAT"],
  OFERTAT: ["CONFIRMAT", "ANULAT"],
  CONFIRMAT: ["RECEPTIONAT", "ANULAT"],
  RECEPTIONAT: ["LIVRAT", "ANULAT"],
  LIVRAT: [],
  ANULAT: [],
};

/**
 * Statusul venit din formular. Înainte se făcea `as ExternalOrderStatus` pe un
 * string arbitrar: o valoare inventată trecea de cast și abia `NEXT_STATUS[...]`
 * arunca, cu un mesaj despre „undefined".
 */
export function parseExternalOrderStatus(value: string): ExternalOrderStatus {
  // `hasOwn`, nu `in`: „toString" și „constructor" trec prin lanțul de prototipuri.
  if (Object.hasOwn(STATUS_LABELS, value)) return value as ExternalOrderStatus;
  throw new Error("Status de comandă necunoscut.");
}
