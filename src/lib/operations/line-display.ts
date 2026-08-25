/**
 * Afișare unificată pentru liniile de document: linii de catalog (cu produs)
 * și linii externe (piesă de la furnizor, fără produs în catalogul propriu).
 *
 * Modulul exista, dar nu-l importa nimeni — aceeași expresie era copiată în
 * zece locuri. Exporturile pe care nu le cerea nimeni au fost scoase; locurile
 * care adaugă și subtitlul vehiculului își păstrează formatarea proprie.
 */
export type DisplayLine = {
  product?: { externalCode: string | null; description: string } | null;
  externalName?: string | null;
};

export function lineDescription(line: DisplayLine) {
  return line.product?.description ?? line.externalName ?? "Piesă externă";
}
