/**
 * Afișare unificată pentru liniile de document: linii de catalog (cu produs)
 * și linii externe (piesă de la furnizor, fără produs în catalogul propriu).
 */
export type DisplayLine = {
  product?: { externalCode: string | null; description: string } | null;
  externalName?: string | null;
};

export function isExternalLine(line: DisplayLine) {
  return !line.product;
}

export function lineCode(line: DisplayLine) {
  return line.product?.externalCode ?? null;
}

export function lineDescription(line: DisplayLine) {
  return line.product?.description ?? line.externalName ?? "Piesă externă";
}

/** „COD · Denumire" pentru catalog, denumirea liberă pentru extern. */
export function lineLabel(line: DisplayLine) {
  const code = lineCode(line);
  return code ? `${code} · ${lineDescription(line)}` : lineDescription(line);
}
