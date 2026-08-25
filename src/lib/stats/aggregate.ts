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

export type TopProduct = {
  productId: string;
  label: string;
  quantity: number;
  revenueLei: number;
};

const dayLabelFormat = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const monthLabelFormat = new Intl.DateTimeFormat("ro-MD", {
  month: "long",
  year: "numeric",
});

/**
 * Eticheta unei perioade, construită din cheia produsă de SQL
 * (`YYYY-MM-DD`, `IYYY-"W"IW`, `YYYY-MM`).
 *
 * Cheia se despică în numere și se reconstruiește o dată locală, ca eticheta să
 * nu depindă de fusul în care rulează serverul: `new Date("2026-08-24")` ar fi
 * interpretată UTC și ar aluneca cu o zi la vest de Greenwich.
 */
export function periodLabelFromKey(key: string, period: StatsPeriod): string {
  if (period === "week") {
    const [isoYear, isoWeek] = key.split("-W");
    return `Săpt. ${Number(isoWeek)} / ${isoYear}`;
  }

  const [year, month, day] = key.split("-").map(Number);
  if (period === "month") {
    return monthLabelFormat.format(new Date(year, month - 1, 1));
  }
  return dayLabelFormat.format(new Date(year, month - 1, day));
}
