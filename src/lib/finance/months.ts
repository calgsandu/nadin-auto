/**
 * Lunile calendaristice, în fusul serverului. Ținute separat de interogări:
 * închiderea de lună și exportul pentru contabil au nevoie de aceleași margini,
 * iar testele nu trebuie să deschidă o conexiune la bază ca să le verifice.
 */

/** Marginile lunii `YYYY-MM`; luna curentă când parametrul lipsește sau e stricat. */
export function monthBounds(month?: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return { start, end, key };
}

const monthLabelFormat = new Intl.DateTimeFormat("ro-MD", { month: "long", year: "numeric" });

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return monthLabelFormat.format(new Date(year, month - 1, 1));
}

/** Ultimele `count` luni, cea curentă prima — pastilele de filtrare. */
export function recentMonths(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: monthLabelFormat.format(date) };
  });
}

/**
 * Conturile în care stau banii. Prima citire pe o bază goală seamănă casa și
 * contul curent — altfel n-ai unde înregistra prima cheltuială. Verificarea
 * costă exact citirea care se făcea oricum, nu un upsert la fiecare afișare.
 */
