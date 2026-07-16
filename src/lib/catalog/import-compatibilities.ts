type ImportRow = {
  importKey: string;
};

export function groupImportRowsByKey<T extends ImportRow>(rows: T[]) {
  const groups = new Map<string, T[]>();

  for (const row of rows) {
    const group = groups.get(row.importKey);
    if (group) {
      group.push(row);
    } else {
      groups.set(row.importKey, [row]);
    }
  }

  return [...groups].map(([importKey, groupRows]) => ({
    importKey,
    rows: groupRows,
  }));
}
