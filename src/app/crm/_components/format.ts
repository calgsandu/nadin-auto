/**
 * Formatările comune ale CRM-ului. Erau definite în pagina monolitică; acum
 * fiecare secțiune are ruta ei și le importă de aici.
 */

const dateFormat = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const dateTimeFormat = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const moneyFormat = new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 });
const numberFormat = new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 0 });

export function formatDate(value: Date) {
  return dateFormat.format(value);
}

export function formatMoney(value: { toString(): string } | number | null) {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? moneyFormat.format(numeric) : "-";
}

export function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : numberFormat.format(value);
}

export function formatText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

/** Eticheta scurtă din tabelele de operațiuni (recepții/transferuri/vânzări). */
export function formatDocumentType(type: string) {
  if (type === "RECEIPT") return "Recepție";
  if (type === "SALE") return "Vânzare";
  return "Transfer";
}

/** Eticheta completă din „Documente", unde apar și retururile și ajustările. */
export function formatDocType(type: string) {
  if (type === "RECEIPT") return "Recepție";
  if (type === "SALE") return "Vânzare";
  if (type === "RETURN") return "Retur";
  return "Ajustare/Transfer";
}

export function formatYearLabel(
  yearStart: number | null,
  yearEnd: number | null,
  yearOpenEnded: boolean,
) {
  if (!yearStart && !yearEnd) return "-";
  if (yearOpenEnded) return `${yearStart}+`;
  return [yearStart, yearEnd].filter(Boolean).join("-");
}

export function signedNumber(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function formatFormValue(
  value: { toString(): string } | number | null | undefined,
) {
  return value === null || value === undefined ? "" : value.toString();
}
