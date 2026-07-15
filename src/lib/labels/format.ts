export const LABEL_PHONE = "0 (68) 677885";
export const LABEL_COMPATIBILITY_PREFIX = "Piesă auto compatibilă cu modelul";

export function buildCompatibilityLabel({
  brandName,
  modelName,
  yearStart,
  yearEnd,
  yearOpenEnded,
}: {
  brandName: string;
  modelName: string;
  yearStart: number | null;
  yearEnd: number | null;
  yearOpenEnded: boolean;
}) {
  return upperLabelText(
    [
      compactBrandName(brandName),
      modelName,
      formatShortYears(yearStart, yearEnd, yearOpenEnded),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function buildPartLabel(typeName: string, description: string) {
  const type = upperLabelText(typeName);
  const desc = upperLabelText(description);

  if (!type) return desc;
  if (!desc) return type;
  if (normalizeComparable(desc).startsWith(normalizeComparable(type))) return desc;

  return `${type} ${desc}`;
}

export function upperLabelText(value: string | null | undefined) {
  return normalizeWhitespace(value ?? "").toLocaleUpperCase("ro");
}

function compactBrandName(value: string) {
  const brand = upperLabelText(value).replace(/\s+/g, " ");

  if (brand === "MERCEDES-BENZ" || brand === "MERCEDES BENZ" || brand === "MERCEDES") {
    return "MB";
  }

  if (brand === "VOLKSWAGEN") {
    return "VW";
  }

  return brand;
}

function formatShortYears(start: number | null, end: number | null, openEnded: boolean) {
  if (!start && !end) return "";
  if (openEnded) return `${shortYear(start ?? end)}+`;
  if (start && end) return `${shortYear(start)}-${shortYear(end)}`;
  return shortYear(start ?? end);
}

function shortYear(year: number | null) {
  if (!year) return "";
  return String(year >= 100 ? year % 100 : year).padStart(2, "0");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}
