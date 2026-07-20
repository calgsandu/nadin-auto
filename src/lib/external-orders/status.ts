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
