export type StatsSaleLine = {
  quantity: number;
  unitPriceLei: number;
  unitCostLei: number;
  productId: string;
  productLabel: string;
};

export type StatsSale = {
  documentDate: Date;
  lines: StatsSaleLine[];
};

export type PeriodTotals = {
  key: string;
  label: string;
  salesCount: number;
  quantity: number;
  revenueLei: number;
  costLei: number;
  profitLei: number;
};

export type StatsPeriod = "day" | "week" | "month";

/** Bucket sales into day/ISO-week/month totals, newest first. */
export function aggregateSalesByPeriod(
  sales: StatsSale[],
  period: StatsPeriod,
  limit: number,
): PeriodTotals[] {
  const buckets = new Map<string, PeriodTotals>();

  for (const sale of sales) {
    const key = periodKey(sale.documentDate, period);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: periodLabel(sale.documentDate, period),
        salesCount: 0,
        quantity: 0,
        revenueLei: 0,
        costLei: 0,
        profitLei: 0,
      };
      buckets.set(key, bucket);
    }

    bucket.salesCount += 1;
    for (const line of sale.lines) {
      bucket.quantity += line.quantity;
      bucket.revenueLei += line.quantity * line.unitPriceLei;
      bucket.costLei += line.quantity * line.unitCostLei;
    }
    bucket.profitLei = bucket.revenueLei - bucket.costLei;
  }

  return [...buckets.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, limit);
}

export type TopProduct = {
  productId: string;
  label: string;
  quantity: number;
  revenueLei: number;
};

export function topSoldProducts(sales: StatsSale[], limit: number): TopProduct[] {
  const totals = new Map<string, TopProduct>();

  for (const sale of sales) {
    for (const line of sale.lines) {
      const existing = totals.get(line.productId);
      if (existing) {
        existing.quantity += line.quantity;
        existing.revenueLei += line.quantity * line.unitPriceLei;
      } else {
        totals.set(line.productId, {
          productId: line.productId,
          label: line.productLabel,
          quantity: line.quantity,
          revenueLei: line.quantity * line.unitPriceLei,
        });
      }
    }
  }

  return [...totals.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

function periodKey(date: Date, period: StatsPeriod): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (period === "month") return `${year}-${month}`;
  if (period === "week") {
    const { isoYear, isoWeek } = isoWeekOf(date);
    return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
  }
  return `${year}-${month}-${day}`;
}

function periodLabel(date: Date, period: StatsPeriod): string {
  if (period === "month") {
    return new Intl.DateTimeFormat("ro-MD", { month: "long", year: "numeric" }).format(date);
  }
  if (period === "week") {
    const { isoYear, isoWeek } = isoWeekOf(date);
    return `Săpt. ${isoWeek} / ${isoYear}`;
  }
  return new Intl.DateTimeFormat("ro-MD", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function isoWeekOf(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear, isoWeek };
}
