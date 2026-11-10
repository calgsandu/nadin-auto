/**
 * Îmbinarea unei editări de document cu ce s-a salvat între timp pe server.
 *
 * Problema: panoul de editare trimitea TOT documentul, iar serverul înlocuia
 * liniile. Un tab deschis de ieri (sau alt calculator) ștergea la „Salvează"
 * tot ce adăugase între timp altcineva (Inventar #1, 2026-11-10: 14 linii).
 *
 * Acum formularul trimite și versiunea de la care a pornit („baza"). Serverul
 * compară trei variante pe fiecare produs: baza, ce a trimis operatorul
 * („mine") și ce e acum în DB („theirs"). Se aplică doar ce a schimbat
 * operatorul; restul rămâne cum l-a lăsat celălalt.
 */

export type MergeLine = {
  productId: string | null;
  externalName: string | null;
  externalCode: string | null;
  externalSupplierId: string | null;
  externalCost: number | null;
  quantity: number;
  price: number | null;
};

export type MergeHeader = {
  documentDate: string;
  notes: string;
  warehouseId: string;
  partnerId: string;
  partnerName: string;
};

/** Ce a venit de la client ca „baza" editării (exact props-urile panoului). */
export type DocumentBase = {
  lines: {
    productId: string;
    quantity: string;
    price: string;
    externalName?: string;
    externalCode?: string;
    externalSupplierId?: string;
    externalCost?: string;
  }[];
  documentDate: string;
  notes: string;
  warehouseId: string;
  partnerId: string;
  partnerName: string;
};

export type LineConflict = { key: string; label: string };

function numberOrNull(raw: unknown) {
  if (raw == null) return null;
  const text = String(raw).trim().replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Cheia unei linii: produsul; liniile externe după nume + cod (+ a câta apariție). */
export function lineKeys(lines: MergeLine[]) {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    if (line.productId) return line.productId;
    const raw = `ext:${(line.externalName ?? "").trim().toLowerCase()}|${(line.externalCode ?? "").trim().toLowerCase()}`;
    const count = seen.get(raw) ?? 0;
    seen.set(raw, count + 1);
    return `${raw}#${count}`;
  });
}

function signature(line: MergeLine | undefined) {
  if (!line) return "∅";
  return JSON.stringify([
    line.quantity,
    line.price,
    line.externalCost,
    line.externalSupplierId || null,
  ]);
}

function byKey(lines: MergeLine[]) {
  const keys = lineKeys(lines);
  return new Map(keys.map((key, index) => [key, lines[index]]));
}

/**
 * Îmbinare pe linii. Reguli, per produs:
 * - operatorul n-a atins linia → rămâne varianta din DB (inclusiv ștearsă);
 * - celălalt n-a atins-o → câștigă operatorul;
 * - amândoi au schimbat-o la fel → nimic de decis;
 * - amândoi au schimbat-o diferit → câștigă operatorul, iar linia se raportează.
 * Liniile adăugate doar de celălalt intră sus, ca orice rând nou.
 */
export function mergeDocumentLines(
  base: MergeLine[],
  mine: MergeLine[],
  theirs: MergeLine[],
  labelOf: (line: MergeLine) => string = (line) =>
    line.productId ?? line.externalName ?? "linie",
) {
  const baseMap = byKey(base);
  const mineMap = byKey(mine);
  const theirsMap = byKey(theirs);

  const order = [
    ...[...theirsMap.keys()].filter((key) => !baseMap.has(key) && !mineMap.has(key)),
    ...mineMap.keys(),
    ...[...theirsMap.keys()].filter((key) => baseMap.has(key) && !mineMap.has(key)),
  ];

  const lines: MergeLine[] = [];
  const conflicts: LineConflict[] = [];
  for (const key of new Set(order)) {
    const b = baseMap.get(key);
    const m = mineMap.get(key);
    const t = theirsMap.get(key);
    let pick: MergeLine | undefined;
    if (signature(m) === signature(b)) pick = t;
    else if (signature(t) === signature(b)) pick = m;
    else if (signature(m) === signature(t)) pick = m;
    else {
      pick = m;
      const reference = m ?? t ?? b;
      if (reference) conflicts.push({ key, label: labelOf(reference) });
    }
    if (pick) lines.push(pick);
  }

  const theirsChanged =
    base.length !== theirs.length ||
    [...baseMap].some(([key, line]) => signature(theirsMap.get(key)) !== signature(line));

  return { lines, conflicts, theirsChanged };
}

/** Antetul: câmp cu câmp, aceleași reguli (operatorul câștigă la conflict). */
export function mergeDocumentHeader(base: MergeHeader, mine: MergeHeader, theirs: MergeHeader) {
  const merged = { ...theirs };
  const changed: (keyof MergeHeader)[] = [];
  for (const field of Object.keys(base) as (keyof MergeHeader)[]) {
    if (mine[field] !== base[field]) merged[field] = mine[field];
    if (theirs[field] !== base[field]) changed.push(field);
  }
  return { header: merged, theirsChanged: changed.length > 0 };
}

/** Baza trimisă de client → aceeași formă ca liniile parsate din formular. */
export function parseDocumentBase(raw: string, keepPrice: boolean) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const base = parsed as Partial<DocumentBase>;
  if (!Array.isArray(base.lines)) return null;

  const lines: MergeLine[] = base.lines.flatMap((line) => {
    const quantity = Number(line?.quantity);
    if (!line || !Number.isInteger(quantity) || quantity === 0) return [];
    const productId = String(line.productId ?? "").trim() || null;
    const externalName = productId ? null : String(line.externalName ?? "").trim() || null;
    if (!productId && !externalName) return [];
    return [{
      productId,
      externalName,
      externalCode: productId ? null : String(line.externalCode ?? "").trim() || null,
      externalSupplierId: productId ? null : String(line.externalSupplierId ?? "").trim() || null,
      externalCost: productId ? null : numberOrNull(line.externalCost),
      quantity,
      price: keepPrice ? numberOrNull(line.price) : null,
    }];
  });

  return {
    lines,
    header: {
      documentDate: String(base.documentDate ?? ""),
      notes: String(base.notes ?? "").trim(),
      warehouseId: String(base.warehouseId ?? ""),
      partnerId: String(base.partnerId ?? ""),
      partnerName: String(base.partnerName ?? "").trim(),
    } satisfies MergeHeader,
  };
}

/** O linie din DB → forma de comparat (prețul stă pe câmpul tipului de document). */
export function mergeLineFromDb(
  line: {
    productId: string | null;
    externalName: string | null;
    externalCode: string | null;
    externalSupplierId: string | null;
    quantity: number;
    unitPriceEuro: { toString(): string } | null;
    unitCostLei: { toString(): string } | null;
  },
  documentType: string,
): MergeLine {
  const usesSalePrice = documentType === "SALE" || documentType === "RETURN";
  return {
    productId: line.productId,
    externalName: line.productId ? null : line.externalName?.trim() || null,
    externalCode: line.productId ? null : line.externalCode?.trim() || null,
    externalSupplierId: line.productId ? null : line.externalSupplierId || null,
    externalCost: line.productId ? null : numberOrNull(line.unitCostLei),
    quantity: line.quantity,
    // Inventarul nu are preț editabil; formularul trimite mereu gol.
    price:
      documentType === "ADJUSTMENT"
        ? null
        : numberOrNull(usesSalePrice ? line.unitPriceEuro : line.unitCostLei),
  };
}
