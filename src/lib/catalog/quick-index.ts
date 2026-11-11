import {
  normalizeCode,
  normalizeText,
  parseYearTerm,
  searchTerms,
} from "@/lib/catalog/search-text";

/**
 * Indexul local al paletei de comenzi (Ctrl+K): tot catalogul, redus la ce se
 * vede într-un rezultat, căutat în browser — fără drum la server pe fiecare
 * literă. Fără Prisma aici: fișierul rulează și în client.
 *
 * Aceleași reguli ca `findMatchingProductIds` (cod fără spații, termeni fără
 * diacritice, anul prins și ca interval de fabricație), ca paleta și pagina
 * Produse să nu dea răspunsuri diferite la aceeași căutare.
 */
export type QuickProduct = {
  id: string;
  code: string | null;
  altCode: string | null;
  description: string;
  type: string;
  /** „AUDI A4 1994–2000 • VW PASSAT B5 1996–2000" (vezi `vehicleLabels`). */
  vehicles: string;
  stock: number;
  /** Aliniat cu `QuickIndex.warehouses`. */
  stocks: number[];
  price: number | null;
};

export type QuickCustomer = { id: string; name: string; phone: string | null };

export type QuickIndex = {
  warehouses: string[];
  products: QuickProduct[];
  /** Gol pentru rolurile care n-au secțiunea Clienți. */
  customers: QuickCustomer[];
};

/** Cifrele telefonului fără prefix: „069 123…" și „+373 69 123…" sunt același număr. */
const phoneKey = (value: string) => value.replace(/\D/g, "").replace(/^(373|0)/, "");

/** Clienții după nume (fără diacritice) sau după cifrele din telefon. */
export function searchQuickCustomers(customers: QuickCustomer[], query: string, limit = 4) {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const digits = phoneKey(query);
  return customers
    .filter((customer) => {
      const name = normalizeText(customer.name);
      return (
        terms.every((term) => name.includes(term)) ||
        (digits.length >= 4 && phoneKey(customer.phone ?? "").includes(digits))
      );
    })
    .slice(0, limit);
}

type Prepared = {
  product: QuickProduct;
  code: string;
  part: string;
  vehicle: string;
  text: string;
  years: Array<[number, number]>;
};

const OPEN_END = 9999;

/** Intervalele de ani din etichetă: „1994–2000", „2006–prezent", „din 1998". */
function yearRanges(vehicles: string) {
  const ranges: Array<[number, number]> = [];
  for (const match of vehicles.matchAll(/(\d{4})–(\d{4}|prezent)|din (\d{4})/g)) {
    if (match[3]) ranges.push([Number(match[3]), Number(match[3])]);
    else ranges.push([Number(match[1]), match[2] === "prezent" ? OPEN_END : Number(match[2])]);
  }
  return ranges;
}

export function prepareQuickIndex(products: QuickProduct[]): Prepared[] {
  return products.map((product) => {
    const part = normalizeText(`${product.description} ${product.type}`);
    const vehicle = normalizeText(product.vehicles);
    const codes = `${product.code ?? ""} ${product.altCode ?? ""}`;
    return {
      product,
      code: normalizeCode(codes),
      part,
      vehicle,
      text: `${normalizeText(codes)} ${part} ${vehicle}`,
      years: yearRanges(product.vehicles),
    };
  });
}

/**
 * Cele mai bune `limit` potriviri. Scor: codul exact bate tot, apoi începutul
 * de cod, apoi termenii — mai grei în denumirea piesei decât în mașină. La scor
 * egal, ce e în stoc vine primul: la ghișeu contează ce poți vinde acum.
 */
export function searchQuickIndex(prepared: Prepared[], query: string, limit = 8): QuickProduct[] {
  const terms = searchTerms(query);
  const code = normalizeCode(query);
  if (terms.length === 0) return [];

  const scored: Array<{ product: QuickProduct; score: number }> = [];
  for (const entry of prepared) {
    let score = 0;
    if (code.length >= 3 && entry.code) {
      if (entry.code === code) score += 1000;
      else if (entry.code.startsWith(code)) score += 600;
      else if (entry.code.includes(code)) score += 300;
    }

    let allTerms = true;
    for (const term of terms) {
      const year = parseYearTerm(term);
      const inYears = year !== null && entry.years.some(([from, to]) => from <= year && year <= to);
      if (!inYears && !entry.text.includes(term)) {
        allTerms = false;
        break;
      }
      if (entry.part.includes(term)) score += 30;
      if (inYears || entry.vehicle.includes(term)) score += 25;
    }

    if (allTerms || score >= 300) scored.push({ product: entry.product, score });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.product.stock > 0) - Number(a.product.stock > 0) ||
        a.product.description.localeCompare(b.product.description, "ro"),
    )
    .slice(0, limit)
    .map((entry) => entry.product);
}
