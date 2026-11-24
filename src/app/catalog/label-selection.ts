export const MIN_LABEL_COUNT = 1;
export const MAX_LABEL_COUNT = 50;

export type LabelSelectionItem = {
  id: string;
  code: string;
  alternativeCode: string;
  name: string;
  compatibility: string;
  count: number;
  includeAlternativeCode: boolean;
};

export function clampLabelCount(value: number) {
  return Math.min(
    Math.max(Math.round(value) || MIN_LABEL_COUNT, MIN_LABEL_COUNT),
    MAX_LABEL_COUNT,
  );
}

export function parseLabelSelection(value: string | null): LabelSelectionItem[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const byId = new Map<string, LabelSelectionItem>();
    for (const entry of parsed) {
      let item: LabelSelectionItem | null = null;

      if (typeof entry === "string") {
        item = {
          id: entry,
          code: "",
          alternativeCode: "",
          name: "",
          compatibility: "",
          count: 1,
          includeAlternativeCode: false,
        };
      } else if (entry && typeof entry === "object") {
        const stored = entry as Record<string, unknown>;
        if (typeof stored.id === "string") {
          const alternativeCode =
            typeof stored.alternativeCode === "string"
              ? stored.alternativeCode
              : "";
          item = {
            id: stored.id,
            code: typeof stored.code === "string" ? stored.code : "",
            alternativeCode,
            name: typeof stored.name === "string" ? stored.name : "",
            compatibility:
              typeof stored.compatibility === "string"
                ? stored.compatibility
                : "",
            count: clampLabelCount(Number(stored.count)),
            includeAlternativeCode: Boolean(
              alternativeCode.trim() && stored.includeAlternativeCode === true,
            ),
          };
        }
      }

      if (item?.id.trim()) byId.set(item.id, item);
    }

    return [...byId.values()];
  } catch {
    return [];
  }
}

export function serializeLabelSelection(items: LabelSelectionItem[]) {
  return JSON.stringify(items);
}

export function setLabelCount(
  items: LabelSelectionItem[],
  id: string,
  count: number,
) {
  return items.map((item) =>
    item.id === id ? { ...item, count: clampLabelCount(count) } : item,
  );
}

export function setLabelAlternativeCode(
  items: LabelSelectionItem[],
  id: string,
  include: boolean,
) {
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          includeAlternativeCode: Boolean(
            include && item.alternativeCode.trim(),
          ),
        }
      : item,
  );
}

export function toggleLabelSelection(
  items: LabelSelectionItem[],
  item: LabelSelectionItem,
  checked: boolean,
) {
  if (!checked) return items.filter((current) => current.id !== item.id);

  const index = items.findIndex((current) => current.id === item.id);
  if (index === -1) {
    return [
      ...items,
      {
        ...item,
        count: clampLabelCount(item.count),
        includeAlternativeCode: Boolean(
          item.includeAlternativeCode && item.alternativeCode.trim(),
        ),
      },
    ];
  }

  const current = items[index];
  if (
    current.code === item.code &&
    current.alternativeCode === item.alternativeCode &&
    current.name === item.name &&
    current.compatibility === item.compatibility
  ) {
    return items;
  }

  return items.map((entry, entryIndex) =>
    entryIndex === index
      ? {
          ...entry,
          code: item.code,
          alternativeCode: item.alternativeCode,
          name: item.name,
          compatibility: item.compatibility,
          includeAlternativeCode: Boolean(
            entry.includeAlternativeCode && item.alternativeCode.trim(),
          ),
        }
      : entry,
  );
}

export function hydrateLabelSelection(
  items: LabelSelectionItem[],
  visibleItems: LabelSelectionItem[],
) {
  const visibleById = new Map(visibleItems.map((item) => [item.id, item]));
  let changed = false;

  const hydrated = items.map((item) => {
    const visible = visibleById.get(item.id);
    if (
      !visible ||
      (visible.code === item.code &&
        visible.alternativeCode === item.alternativeCode &&
        visible.name === item.name &&
        visible.compatibility === item.compatibility)
    ) {
      return item;
    }

    changed = true;
    return {
      ...item,
      code: visible.code,
      alternativeCode: visible.alternativeCode,
      name: visible.name,
      compatibility: visible.compatibility,
      includeAlternativeCode: Boolean(
        item.includeAlternativeCode && visible.alternativeCode.trim(),
      ),
    };
  });

  return changed ? hydrated : items;
}

export type LabelPrintFormat = { size: "s" | "m" | "l"; layout: "grid" | "roll" };

export const DEFAULT_LABEL_FORMAT: LabelPrintFormat = { size: "l", layout: "grid" };

export function buildLabelPrintQuery(
  items: LabelSelectionItem[],
  format: LabelPrintFormat = DEFAULT_LABEL_FORMAT,
) {
  const query = new URLSearchParams();
  query.set(
    "items",
    items.map((item) => `${item.id}:${item.count}`).join(","),
  );
  const alternativeIds = items
    .filter(
      (item) => item.includeAlternativeCode && item.alternativeCode.trim(),
    )
    .map((item) => item.id);
  if (alternativeIds.length > 0) {
    query.set("alt", alternativeIds.join(","));
  }
  query.set("size", format.size);
  query.set("layout", format.layout);
  return query;
}

/** Ce trimite un punct de intrare (recepție, fișă, rând): doar produsul și câte bucăți. */
export type LabelAddition = { id: string; count: number };

export function emptyLabelItem(id: string, count = MIN_LABEL_COUNT): LabelSelectionItem {
  return {
    id,
    code: "",
    alternativeCode: "",
    name: "",
    compatibility: "",
    count: clampLabelCount(count),
    includeAlternativeCode: false,
  };
}

/**
 * Adaugă în listă: produsul deja trecut își crește numărul (două recepții cu
 * aceeași piesă = stickere pentru ambele), cel nou intră la coadă.
 */
export function addLabelItems(items: LabelSelectionItem[], additions: LabelAddition[]) {
  const next = [...items];
  for (const { id, count } of additions) {
    if (!id.trim() || !(count > 0)) continue;
    const index = next.findIndex((item) => item.id === id);
    if (index === -1) next.push(emptyLabelItem(id, count));
    else next[index] = { ...next[index], count: clampLabelCount(next[index].count + count) };
  }
  return next;
}

/** Completează codul/denumirea venite de la server pentru rândurile adăugate fără ele. */
export function fillLabelDetails(
  items: LabelSelectionItem[],
  details: Omit<LabelSelectionItem, "count" | "includeAlternativeCode">[],
) {
  if (details.length === 0) return items;
  const byId = new Map(details.map((detail) => [detail.id, detail]));
  return items.map((item) => {
    const detail = byId.get(item.id);
    return detail && !item.code && !item.name ? { ...item, ...detail } : item;
  });
}
