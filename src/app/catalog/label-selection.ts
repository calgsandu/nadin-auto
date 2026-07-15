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

export function toggleLabelSelection(
  items: LabelSelectionItem[],
  item: LabelSelectionItem,
  checked: boolean,
) {
  if (!checked) return items.filter((current) => current.id !== item.id);

  const index = items.findIndex((current) => current.id === item.id);
  if (index === -1) {
    return [...items, { ...item, count: clampLabelCount(item.count) }];
  }

  const current = items[index];
  if (current.code === item.code && current.name === item.name) return items;

  return items.map((entry, entryIndex) =>
    entryIndex === index
      ? { ...entry, code: item.code, name: item.name }
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
    if (!visible || (visible.code === item.code && visible.name === item.name)) {
      return item;
    }

    changed = true;
    return { ...item, code: visible.code, name: visible.name };
  });

  return changed ? hydrated : items;
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
