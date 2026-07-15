export const MIN_LABEL_COUNT = 1;
export const MAX_LABEL_COUNT = 50;

export type LabelSelectionItem = {
  id: string;
  code: string;
  name: string;
  count: number;
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
        item = { id: entry, code: "", name: "", count: 1 };
      } else if (entry && typeof entry === "object") {
        const stored = entry as Record<string, unknown>;
        if (typeof stored.id === "string") {
          item = {
            id: stored.id,
            code: typeof stored.code === "string" ? stored.code : "",
            name: typeof stored.name === "string" ? stored.name : "",
            count: clampLabelCount(Number(stored.count)),
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

export function buildLabelPrintQuery(items: LabelSelectionItem[]) {
  const query = new URLSearchParams();
  query.set(
    "items",
    items.map((item) => `${item.id}:${item.count}`).join(","),
  );
  query.set("layout", "grid");
  return query;
}
