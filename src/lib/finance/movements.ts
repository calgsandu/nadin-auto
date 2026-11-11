import type { MoneyMovementKind } from "@/generated/prisma/enums";

export const MOVEMENT_KINDS: readonly { id: MoneyMovementKind; label: string; hint: string }[] = [
  { id: "DEPUNERE", label: "Depunere", hint: "Bani puși în cont din afara firmei." },
  { id: "RETRAGERE", label: "Retragere", hint: "Bani scoși din cont, fără să fie cheltuială." },
  { id: "TRANSFER", label: "Transfer între conturi", hint: "Din casă în bancă sau invers." },
  { id: "ALTA_INCASARE", label: "Altă încasare", hint: "Bani intrați din altceva decât o vânzare." },
  { id: "ALTA_PLATA", label: "Altă plată", hint: "Bani ieșiți fără document de cheltuială." },
];

const LABELS = new Map(MOVEMENT_KINDS.map((kind) => [kind.id, kind.label]));

export function movementKindLabel(kind: MoneyMovementKind) {
  return LABELS.get(kind) ?? kind;
}

export function isMovementKind(value: string): value is MoneyMovementKind {
  return LABELS.has(value as MoneyMovementKind);
}

/**
 * Semnul unei mișcări: `+1` bagă bani în cont, `-1` îi scoate.
 *
 * Transferul are semn doar în capătul din care pleacă banii; celălalt rând se
 * scrie cu semnul opus, de aceea nu apare aici.
 */
export function movementSign(kind: MoneyMovementKind): 1 | -1 {
  return kind === "DEPUNERE" || kind === "ALTA_INCASARE" ? 1 : -1;
}
