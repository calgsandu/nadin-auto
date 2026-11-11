import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/finance/months";

/** Cheia de lună a unei date, în fusul serverului: „2026-08". */
export function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function periodLockedMessage(monthKey: string) {
  return `Luna ${monthLabel(monthKey)} este închisă contabil. Redeschiderea o poate face doar un administrator, din „Închidere de lună".`;
}

/**
 * Poarta oricărei scrieri datate: aruncă dacă luna datei e închisă.
 *
 * Se verifică `documentDate`, nu `now()`: altfel un document antedatat ar putea
 * intra într-o lună deja raportată, exact scenariul pe care blocarea îl oprește.
 * Ștergerile și editările trec pe aici cu data DINAINTE de schimbare, iar
 * mutarea unui document dintr-o lună deschisă într-una închisă cere ambele date
 * verificate — de aceea funcția primește oricâte.
 */
export async function assertPeriodOpen(...dates: (Date | null | undefined)[]) {
  const months = [...new Set(dates.filter(Boolean).map((date) => monthKeyOf(date!)))];
  if (months.length === 0) return;

  const closed = await prisma.accountingPeriod.findFirst({
    where: { month: { in: months }, reopenedAt: null },
    select: { month: true },
    orderBy: { month: "asc" },
  });

  if (closed) throw new Error(periodLockedMessage(closed.month));
}

/**
 * Garda pentru un document existent: se verifică luna în care stă ACUM și, dacă
 * i se schimbă data, și luna în care ar ajunge. Fără a doua verificare, un
 * document dintr-o lună deschisă ar putea fi mutat într-una închisă.
 */
export async function assertDocumentPeriodOpen(
  documentId: string,
  newDate?: Date | null,
) {
  const document = await prisma.stockDocument.findUnique({
    where: { id: documentId },
    select: { documentDate: true },
  });
  if (!document) return;

  await assertPeriodOpen(document.documentDate, newDate);
}

/** Aceeași gardă, pentru un cont de plată: luna emiterii lui. */
export async function assertPaymentAccountPeriodOpen(id: string) {
  const account = await prisma.paymentAccount.findUnique({
    where: { id },
    select: { issueDate: true },
  });
  if (!account) return;

  await assertPeriodOpen(account.issueDate);
}

/** Lunile închise, pentru afișare. */
export async function listClosedPeriods() {
  const periods = await prisma.accountingPeriod.findMany({
    orderBy: { month: "desc" },
    take: 24,
  });

  return periods.map((period) => ({
    id: period.id,
    month: period.month,
    label: monthLabel(period.month),
    closedAt: period.closedAt,
    closedByName: period.closedByName,
    note: period.note,
    reopenedAt: period.reopenedAt,
    reopenedByName: period.reopenedByName,
    reopenNote: period.reopenNote,
    locked: period.reopenedAt === null,
  }));
}

export type ClosedPeriod = Awaited<ReturnType<typeof listClosedPeriods>>[number];

/** Luna cerută e închisă acum? */
export async function isPeriodClosed(monthKey: string) {
  const period = await prisma.accountingPeriod.findFirst({
    where: { month: monthKey, reopenedAt: null },
    select: { id: true },
  });
  return period !== null;
}
