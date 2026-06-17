export type RestockStatus = "PENDING" | "DELIVERED" | "UNAVAILABLE";

export function aggregateRestockRequests(
  lines: Array<{ productId: string; quantity: number }>,
) {
  const totals = new Map<string, number>();

  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  }

  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

export function splitRestockTasksByStatus<T extends { status: RestockStatus }>(
  tasks: T[],
) {
  return {
    pending: tasks.filter((task) => task.status === "PENDING"),
    unavailable: tasks.filter((task) => task.status === "UNAVAILABLE"),
  };
}
