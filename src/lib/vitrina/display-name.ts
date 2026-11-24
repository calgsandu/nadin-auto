/**
 * Numele de mărci și modele vin din import exact cum au fost tastate:
 * „MERCEDES-BENZ”, „DUCATO- II”, „KA -I”. În vitrină le arătăm îngrijit
 * („Mercedes-Benz”, „Ducato II”, „Ka I”), fără să atingem datele sau slug-urile.
 *
 * Rămân cu majuscule: părțile cu cifre (W639, T-4, E-11), numeralele romane,
 * literele singure (C-3, H-200) și abrevierile cunoscute (BMW, CRV, MPV…).
 */
const KEEP_UPPER = new Set([
  "BMW", "CRV", "HR", "MPV", "ML", "LT", "RAV", "GTI", "TDI", "SUV", "HB", "MX", "CX", "XC", "DS",
]);
const ROMAN = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/;

function formatPart(part: string): string {
  if (!part) return part;
  const upper = part.toUpperCase();
  const core = upper.replace(/[^A-Z0-9]/g, "");
  if (/\d/.test(core) || ROMAN.test(core) || core.length <= 1 || KEEP_UPPER.has(core)) {
    return upper;
  }
  // Numele deja scrise cu litere mici/mixte („Golf”, „Vito”) rămân cum sunt.
  if (part !== upper) return part;
  // Prima literă mare, chiar și după o paranteză: „(XSARA” → „(Xsara”.
  const first = upper.search(/[A-Z]/);
  return upper.slice(0, first + 1) + upper.slice(first + 1).toLowerCase();
}

export function displayName(raw: string): string {
  const cleaned = raw
    .trim()
    // „DUCATO- II”, „KA -I”, „GOLF- IV”: cratima lipită de spațiu era doar un separator.
    .replace(/\s*-\s+|\s+-\s*/g, " ")
    .replace(/\s+/g, " ");
  return cleaned
    .split(" ")
    .map((word) => word.split("-").map(formatPart).join("-"))
    .join(" ");
}
