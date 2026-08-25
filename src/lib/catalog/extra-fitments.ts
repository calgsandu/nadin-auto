export type ExtraFitmentInput = {
  modelId: string;
  yearStart: number | null;
  yearEnd: number | null;
  yearOpenEnded: boolean;
};

/**
 * Compatibilitățile suplimentare din formularul de produs (aceeași piesă pe alte
 * modele). Se trimite doar `extraModelId`: brandul de pe rând e strict pentru
 * filtrarea listei de modele. Rândurile fără model sunt ignorate.
 */
export function parseExtraFitments(formData: FormData): ExtraFitmentInput[] {
  const modelIds = readStrings(formData, "extraModelId");
  const yearStarts = readStrings(formData, "extraYearStart");
  const yearEnds = readStrings(formData, "extraYearEnd");
  const openEnded = readStrings(formData, "extraYearOpenEnded");

  return modelIds.flatMap((modelId, index) => {
    if (!modelId) return [];
    const yearOpenEnded = Boolean(openEnded[index]);
    const yearStart = toOptionalYear(yearStarts[index], "anul de început");
    const yearEnd = yearOpenEnded ? null : toOptionalYear(yearEnds[index], "anul final");

    if (yearStart && yearEnd && yearStart > yearEnd) {
      throw new Error("Anul de început nu poate fi mai mare decât anul final.");
    }

    return [{ modelId, yearStart, yearEnd, yearOpenEnded }];
  });
}

function readStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""));
}

function toOptionalYear(value: string | undefined, label: string) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Completează ${label} ca număr întreg.`);
  }
  return parsed;
}
