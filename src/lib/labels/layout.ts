// Foi autoadezive A4. mx/my = marginile foii până la prima etichetă.
// padX păstrează textul departe de tăieturile laterale; grila de 210 mm nu trebuie
// deplasată, altfel dialogul de print o poate micșora.
export const LABEL_SIZES = {
  s: {
    w: 52,
    h: 30,
    cols: 3,
    rows: 9,
    mx: 27,
    my: 13.5,
    padX: 2.5,
    detailOffsetX: 0,
    gy: 0,
    code: 15,
    model: 12,
    desc: 7.5,
    phone: 8,
  },
  m: {
    w: 70,
    h: 42.4,
    cols: 3,
    rows: 7,
    mx: 0,
    my: 0,
    padX: 2.5,
    detailOffsetX: 0,
    gy: 0,
    code: 22,
    model: 17,
    desc: 10.5,
    phone: 12,
  },
  l: {
    w: 70,
    h: 52,
    cols: 3,
    rows: 5,
    mx: 0,
    my: 22.5,
    padX: 4,
    detailOffsetX: 2,
    gy: 3.3,
    code: 26,
    model: 20,
    desc: 12,
    phone: 14,
  },
} as const;

export type LabelSizeKey = keyof typeof LABEL_SIZES;

/**
 * Unde stă fiecare sticker: `cells[i]` = id-ul piesei din celula i (numărată
 * peste toate foile) sau null = celulă goală. `placed` e așezarea făcută de mână
 * (drag & drop); se potrivește la numărul curent de bucăți: copiile în plus
 * dispar de la coadă, cele noi intră după ultimul sticker. Fără `placed`,
 * stickerele vin la rând de la poziția `skip`.
 */
export function placeLabels(
  items: { id: string; count: number }[],
  placed: (string | null)[] | null,
  skip = 0,
) {
  const left = new Map(items.map((item) => [item.id, item.count]));
  const cells: (string | null)[] = placed
    ? placed.map((id) => {
        const n = id ? (left.get(id) ?? 0) : 0;
        if (!id || n <= 0) return null;
        left.set(id, n - 1);
        return id;
      })
    : Array.from({ length: skip }, () => null);
  const trim = () => {
    while (cells.length > 0 && cells[cells.length - 1] === null) cells.pop();
  };
  if (placed) trim();
  for (const { id } of items) for (let n = left.get(id) ?? 0; n > 0; n--) cells.push(id);
  trim();
  return cells;
}

/** `cells` în URL: indexul piesei din `items` (baza 36) per celulă, gol = celulă liberă. */
export function encodeLabelCells(cells: (string | null)[], ids: string[]) {
  const index = new Map(ids.map((id, i) => [id, i.toString(36)]));
  return cells.map((id) => (id ? (index.get(id) ?? "") : "")).join(".");
}

export function decodeLabelCells(value: string | null | undefined, ids: string[]) {
  if (!value) return null;
  return value
    .split(".")
    .slice(0, 2000)
    .map((part) => (part ? (ids[parseInt(part, 36)] ?? null) : null));
}
