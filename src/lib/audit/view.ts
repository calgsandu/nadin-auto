/**
 * Transformă `AuditLog.details` (JSON brut) în secțiuni lizibile pentru
 * „Vezi detalii": ce s-a schimbat în antet, ce produse au intrat/ieșit,
 * cum s-a modificat stocul pe locații.
 *
 * Funcție pură: rulează în client, numele produselor fără etichetă în snapshot
 * (inventarul salvează doar `productId`) vin prin `productNames`.
 */

export type AuditViewRow = { label: string; value: string };
export type AuditViewSection = { title?: string; rows: AuditViewRow[] };

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const FIELD_LABEL: Record<string, string> = {
  type: "Tip",
  number: "Număr",
  documentDate: "Data",
  warehouse: "Locație",
  partner: "Partener",
  notes: "Note",
  notesRu: "Note (RU)",
  totalLei: "Total lei",
  totalEuro: "Total euro",
  description: "Denumire",
  descriptionRu: "Denumire (RU)",
  externalCode: "Cod",
  alternativeCode: "Cod alternativ",
  stock: "Stoc total",
  costLei: "Cost lei",
  salePriceLei: "Preț vânzare lei",
  priceEuro: "Preț euro",
  username: "Utilizator",
  role: "Rol",
  active: "Activ",
  expiresAt: "Expiră la",
  enrollmentGrantIssued: "Cod de activare 2FA emis",
  event: "Eveniment",
  paymentMethod: "Plată",
  cashRegistered: "Înregistrat în casă",
  amount: "Sumă",
  amountLei: "Sumă lei",
  date: "Data",
  paidAt: "Plătit la",
  kind: "Tip",
  category: "Categorie",
  twoFactorReset: "2FA resetat",
};

const VALUE_LABEL: Record<string, string> = {
  RECEIPT: "Recepție",
  SALE: "Vânzare",
  RETURN: "Retur",
  ADJUSTMENT: "Ajustare/Transfer",
  ADMIN: "Administrator",
  DIRECTOR: "Director",
  ANGAJAT: "Angajat",
  CASH: "Numerar",
  CARD: "Card",
  CREDIT: "Credit",
  TRANSFER: "Transfer",
  TWO_FACTOR_ENROLLMENT_ACTIVATED: "Authenticator activat",
  TWO_FACTOR_ENROLLMENT_GRANT_CONSUMED: "Cod de activare folosit",
  TWO_FACTOR_BOOTSTRAP_STARTED: "Activare 2FA începută",
};

const numberFormat = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Id-urile tehnice nu spun nimic omului. */
function isHiddenKey(key: string) {
  return key === "id" || key.endsWith("Id") || key.endsWith("Ids");
}

function label(key: string) {
  return FIELD_LABEL[key] ?? key;
}

export function formatAuditValue(value: Json | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Da" : "Nu";
  if (typeof value === "number") return numberFormat.format(value);
  if (typeof value === "string") {
    const date = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
    if (date) {
      const [, y, m, d, hh, mm] = date;
      return hh ? `${d}.${m}.${y}, ${hh}:${mm}` : `${d}.${m}.${y}`;
    }
    if (VALUE_LABEL[value]) return VALUE_LABEL[value];
    // Enum necunoscut (DEPUNERE, ALTELE…) → „Depunere", „Altele".
    if (/^[A-Z][A-Z_]+$/.test(value)) {
      const words = value.toLowerCase().replaceAll("_", " ");
      return words[0].toUpperCase() + words.slice(1);
    }
    return value;
  }
  if (Array.isArray(value)) return `${value.length} elemente`;
  return Object.entries(value)
    .filter(([key]) => !isHiddenKey(key))
    .map(([key, inner]) => `${label(key)}: ${formatAuditValue(inner)}`)
    .join(", ");
}

function sameValue(a: Json | undefined, b: Json | undefined) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Câmpurile simple (fără liste) care diferă între două snapshot-uri. */
function changedFields(before: JsonObject, after: JsonObject): AuditViewRow[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys
    .filter((key) => !isHiddenKey(key) && !Array.isArray(before[key] ?? after[key]))
    .filter((key) => !sameValue(before[key], after[key]))
    .map((key) => ({
      label: label(key),
      value: `${formatAuditValue(before[key])} → ${formatAuditValue(after[key])}`,
    }));
}

/** Câmpurile completate ale unui snapshot (creare/ștergere). */
function filledFields(snapshot: JsonObject): AuditViewRow[] {
  return Object.entries(snapshot)
    .filter(([key, value]) => !isHiddenKey(key) && !Array.isArray(value))
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => ({ label: label(key), value: formatAuditValue(value) }));
}

type Line = { label: string; quantity: number; price: number };

function lineKey(line: JsonObject) {
  if (typeof line.productId === "string") return line.productId;
  return `${line.externalCode ?? ""}|${line.externalName ?? ""}`;
}

function lineLabel(line: JsonObject, productNames: Record<string, string>) {
  if (typeof line.product === "string" && line.product) return line.product;
  if (typeof line.productId === "string" && productNames[line.productId]) {
    return productNames[line.productId];
  }
  if (typeof line.externalName === "string" && line.externalName) {
    return `${line.externalCode ? `${line.externalCode} · ` : ""}${line.externalName} (extern)`;
  }
  return "Produs fără nume";
}

/** Același produs pe mai multe rânduri = o singură poziție cu cantitatea însumată. */
function groupLines(lines: Json | undefined, productNames: Record<string, string>) {
  const grouped = new Map<string, Line>();
  if (!Array.isArray(lines)) return grouped;
  for (const line of lines) {
    if (!isObject(line)) continue;
    const key = lineKey(line);
    const quantity = typeof line.quantity === "number" ? line.quantity : 0;
    // Snapshot-ul de document are `price`; vânzarea nouă scrie prețurile brute.
    const rawPrice = line.price ?? line.unitPriceEuro ?? line.unitPriceLei ?? line.unitCostLei;
    const price = typeof rawPrice === "number" ? rawPrice : 0;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += quantity;
      existing.price = price;
    } else {
      grouped.set(key, { label: lineLabel(line, productNames), quantity, price });
    }
  }
  return grouped;
}

function quantityText(line: Line) {
  const qty = `${numberFormat.format(line.quantity)} buc`;
  return line.price ? `${qty} × ${numberFormat.format(line.price)}` : qty;
}

function lineSections(
  before: Json | undefined,
  after: Json | undefined,
  productNames: Record<string, string>,
): AuditViewSection[] {
  const old = groupLines(before, productNames);
  const next = groupLines(after, productNames);
  const added: AuditViewRow[] = [];
  const removed: AuditViewRow[] = [];
  const changed: AuditViewRow[] = [];

  for (const [key, line] of next) {
    const previous = old.get(key);
    if (!previous) {
      added.push({ label: line.label, value: quantityText(line) });
      continue;
    }
    const parts: string[] = [];
    if (previous.quantity !== line.quantity) {
      parts.push(
        `${numberFormat.format(previous.quantity)} → ${numberFormat.format(line.quantity)} buc`,
      );
    }
    if (previous.price !== line.price) {
      parts.push(
        `preț ${numberFormat.format(previous.price)} → ${numberFormat.format(line.price)}`,
      );
    }
    if (parts.length) changed.push({ label: line.label, value: parts.join(", ") });
  }
  for (const [key, line] of old) {
    if (!next.has(key)) removed.push({ label: line.label, value: quantityText(line) });
  }

  const sections: AuditViewSection[] = [];
  if (added.length) sections.push({ title: "Produse adăugate", rows: added });
  if (removed.length) sections.push({ title: "Produse scoase", rows: removed });
  if (changed.length) sections.push({ title: "Produse modificate", rows: changed });
  if (!sections.length && next.size) {
    sections.push({ rows: [{ label: "Produse", value: `neschimbate (${next.size})` }] });
  }
  return sections;
}

function stockMap(stocks: Json | undefined) {
  const map = new Map<string, number>();
  if (!Array.isArray(stocks)) return map;
  for (const row of stocks) {
    if (isObject(row) && typeof row.warehouse === "string") {
      map.set(row.warehouse, typeof row.quantity === "number" ? row.quantity : 0);
    }
  }
  return map;
}

function stockChanges(before: Json | undefined, after: Json | undefined): AuditViewRow[] {
  const old = stockMap(before);
  const next = stockMap(after);
  return [...new Set([...old.keys(), ...next.keys()])]
    .filter((warehouse) => (old.get(warehouse) ?? 0) !== (next.get(warehouse) ?? 0))
    .map((warehouse) => ({
      label: warehouse,
      value: `${numberFormat.format(old.get(warehouse) ?? 0)} → ${numberFormat.format(next.get(warehouse) ?? 0)} buc`,
    }));
}

function snapshotSections(
  snapshot: JsonObject,
  productNames: Record<string, string>,
  stocks?: Json,
): AuditViewSection[] {
  const sections: AuditViewSection[] = [];
  const fields = filledFields(snapshot);
  if (fields.length) sections.push({ rows: fields });
  const lines = groupLines(snapshot.lines, productNames);
  if (lines.size) {
    sections.push({
      title: "Produse",
      rows: [...lines.values()].map((line) => ({ label: line.label, value: quantityText(line) })),
    });
  }
  const stockRows = [...stockMap(stocks)]
    .filter(([, quantity]) => quantity !== 0)
    .map(([warehouse, quantity]) => ({
      label: warehouse,
      value: `${numberFormat.format(quantity)} buc`,
    }));
  if (stockRows.length) sections.push({ title: "Stoc pe locații", rows: stockRows });
  return sections;
}

const HANDLED_KEYS = new Set([
  "before",
  "after",
  "deleted",
  "beforeWarehouseStocks",
  "afterWarehouseStocks",
  "warehouseStocks",
  "counts",
  "diffs",
  "lines",
]);

export function describeAuditDetails(
  details: unknown,
  productNames: Record<string, string> = {},
): AuditViewSection[] {
  if (!isObject(details)) {
    return details == null ? [] : [{ rows: [{ label: "Detalii", value: formatAuditValue(details as Json) }] }];
  }
  const sections: AuditViewSection[] = [];

  if (isObject(details.before) && isObject(details.after)) {
    const fields = changedFields(details.before, details.after);
    if (fields.length) sections.push({ title: "Ce s-a schimbat", rows: fields });
    sections.push(...lineSections(details.before.lines, details.after.lines, productNames));
    const stocks = stockChanges(details.beforeWarehouseStocks, details.afterWarehouseStocks);
    if (stocks.length) sections.push({ title: "Stoc pe locații", rows: stocks });
    if (!sections.length) sections.push({ rows: [{ label: "Modificări", value: "nicio diferență" }] });
  } else if (isObject(details.after)) {
    sections.push(...snapshotSections(details.after, productNames, details.warehouseStocks));
  } else if (isObject(details.deleted)) {
    sections.push(...snapshotSections(details.deleted, productNames));
  } else if (Array.isArray(details.lines)) {
    sections.push(...snapshotSections({ lines: details.lines }, productNames));
  }

  if (Array.isArray(details.counts)) {
    const rows = details.counts.filter(isObject).map((count) => {
      const name =
        typeof count.productId === "string" ? productNames[count.productId] : undefined;
      const before = typeof count.before === "number" ? count.before : 0;
      const counted = typeof count.counted === "number" ? count.counted : 0;
      return {
        label: name ?? "Produs necunoscut",
        value:
          before === counted
            ? `${numberFormat.format(counted)} buc, fără diferență`
            : `${numberFormat.format(before)} → ${numberFormat.format(counted)} buc`,
      };
    });
    if (rows.length) sections.push({ title: "Numărat la inventar", rows });
  }

  // Restul intrărilor (utilizatori, 2FA, parteneri…) sunt câmpuri simple.
  const rest = Object.fromEntries(
    Object.entries(details).filter(([key]) => !HANDLED_KEYS.has(key)),
  );
  const restRows = filledFields(rest);
  if (restRows.length) sections.push({ rows: restRows });

  return sections;
}

/** Id-urile de produs fără etichetă în snapshot — trebuie căutate în baza de date. */
export function productIdsToResolve(details: unknown): string[] {
  if (!isObject(details)) return [];
  const rows = [
    ...(Array.isArray(details.counts) ? details.counts : []),
    ...(Array.isArray(details.lines) ? details.lines : []),
  ];
  return [
    ...new Set(
      rows
        .filter(isObject)
        .filter((row) => !row.product)
        .map((row) => row.productId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
}
