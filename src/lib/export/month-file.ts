import { prisma } from "@/lib/prisma";
import { COMPANY, vatFromGross } from "@/lib/company";
import { XLSX } from "@/lib/export/xlsx";
import { monthBounds, monthLabel } from "@/lib/finance/months";
import { getCashRegisterData } from "@/lib/finance/balances";
import { expenseCategoryLabel } from "@/lib/finance/categories";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";

const dateFmt = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type Cell = string | number;

/**
 * Dosarul lunii pentru contabil: un singur .xlsx cu jurnalele pe foi separate.
 *
 * Nu e un import nativ pentru 1C — formatul lui se decide după ce contabilul dă
 * un fișier-model. Până atunci, foile sunt cele pe care le cere oricum: ce s-a
 * vândut, ce s-a cumpărat, ce a intrat și ieșit din fiecare cont, ce s-a
 * cheltuit și cât TVA a ieșit.
 */
export async function buildMonthWorkbook(month?: string) {
  const { start, end, key } = monthBounds(month);
  const label = monthLabel(key);

  const [sales, receipts, expenses, accounts] = await Promise.all([
    prisma.stockDocument.findMany({
      where: { type: { in: ["SALE", "RETURN"] }, documentDate: { gte: start, lt: end } },
      include: { partner: { select: { name: true } } },
      orderBy: [{ documentDate: "asc" }, { number: "asc" }],
    }),
    prisma.stockDocument.findMany({
      where: { type: "RECEIPT", documentDate: { gte: start, lt: end } },
      include: { partner: { select: { name: true, idno: true } } },
      orderBy: [{ documentDate: "asc" }, { number: "asc" }],
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lt: end } },
      include: { partner: { select: { name: true } }, account: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { number: "asc" }],
    }),
    prisma.moneyAccount.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
  ]);

  const workbook = XLSX.utils.book_new();
  const head = (title: string): Cell[][] => [
    [COMPANY.legalName],
    [`IDNO ${COMPANY.idno}, ${COMPANY.address}`],
    [`${title} — ${label}`],
    [],
  ];

  // ─── Jurnal vânzări ───────────────────────────────────────────────────────
  const salesRows = sales.map((doc, index) => {
    const sign = doc.type === "RETURN" ? -1 : 1;
    const gross = sign * Number(doc.totalLei ?? doc.totalEuro ?? 0);
    const { tva, net } = COMPANY.vatPayer ? vatFromGross(gross) : { tva: 0, net: gross };
    return [
      index + 1,
      dateFmt.format(doc.documentDate),
      doc.type === "RETURN" ? `Retur #${doc.number}` : `Vânzare #${doc.number}`,
      doc.externalNumber ?? "",
      doc.partner?.name ?? "Consumator final",
      doc.type === "SALE" ? salePaymentMethodLabel(doc.paymentMethod) : "Retur",
      net,
      tva,
      gross,
    ] satisfies Cell[];
  });
  addSheet(workbook, "Jurnal vânzări", [
    ...head("JURNALUL VÂNZĂRILOR"),
    ["Nr.", "Data", "Document", "Serie factură", "Cumpărător", "Plata", "Fără TVA", "TVA", "Total"],
    ...salesRows,
    [],
    ["", "", "", "", "", "TOTAL", sum(salesRows, 6), sum(salesRows, 7), sum(salesRows, 8)],
  ]);

  // ─── Jurnal cumpărări ─────────────────────────────────────────────────────
  const receiptRows = receipts.map((doc, index) => {
    const gross = Number(doc.totalLei ?? 0);
    const { tva, net } = COMPANY.vatPayer ? vatFromGross(gross) : { tva: 0, net: gross };
    return [
      index + 1,
      dateFmt.format(doc.documentDate),
      `Recepție #${doc.number}`,
      doc.externalNumber ?? "",
      doc.partner?.name ?? "—",
      doc.partner?.idno ?? "",
      doc.dueDate ? dateFmt.format(doc.dueDate) : "",
      net,
      tva,
      gross,
    ] satisfies Cell[];
  });
  addSheet(workbook, "Jurnal cumpărări", [
    ...head("JURNALUL CUMPĂRĂRILOR"),
    ["Nr.", "Data", "Document", "Serie factură", "Furnizor", "IDNO", "Scadența", "Fără TVA", "TVA", "Total"],
    ...receiptRows,
    [],
    ["", "", "", "", "", "", "TOTAL", sum(receiptRows, 7), sum(receiptRows, 8), sum(receiptRows, 9)],
  ]);

  // ─── Registrul fiecărui cont ──────────────────────────────────────────────
  const fromDay = start.toISOString().slice(0, 10);
  const toDay = new Date(end.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const account of accounts) {
    const register = await getCashRegisterData({ acc: account.id, from: fromDay, to: toDay });
    addSheet(workbook, sheetName(`Registru ${account.name}`), [
      ...head(`REGISTRUL CONTULUI „${account.name}"`),
      ["Sold la începutul perioadei", register.openingLei],
      [],
      ["Nr.", "Data", "Mișcare", "Fel", "Intrări", "Ieșiri", "Sold"],
      ...register.entries.map((entry, index) => [
        index + 1,
        dateFmt.format(entry.date),
        entry.label,
        entry.kind,
        entry.amountLei > 0 ? entry.amountLei : "",
        entry.amountLei < 0 ? -entry.amountLei : "",
        entry.balanceLei,
      ] satisfies Cell[]),
      [],
      ["Sold la sfârșitul perioadei", register.closingLei],
    ]);
  }

  // ─── Cheltuieli ───────────────────────────────────────────────────────────
  const expenseRows = expenses.map((expense, index) => [
    index + 1,
    dateFmt.format(expense.date),
    `#${expense.number}`,
    expenseCategoryLabel(expense.category),
    expense.description,
    expense.partner?.name ?? "",
    expense.account.name,
    Number(expense.amountLei),
  ] satisfies Cell[]);

  const byCategory = new Map<string, number>();
  for (const expense of expenses) {
    const categoryLabel = expenseCategoryLabel(expense.category);
    byCategory.set(categoryLabel, (byCategory.get(categoryLabel) ?? 0) + Number(expense.amountLei));
  }

  addSheet(workbook, "Cheltuieli", [
    ...head("CHELTUIELILE LUNII"),
    ["Nr.", "Data", "Document", "Categorie", "Descriere", "Către", "Plătit din", "Suma"],
    ...expenseRows,
    [],
    ["", "", "", "", "", "", "TOTAL", sum(expenseRows, 7)],
    [],
    ["Pe categorii"],
    ...[...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoryLabel, amount]) => [categoryLabel, amount] satisfies Cell[]),
  ]);

  // ─── TVA ──────────────────────────────────────────────────────────────────
  const salesGross = sum(salesRows, 8);
  const purchasesGross = sum(receiptRows, 9);
  const collected = COMPANY.vatPayer ? vatFromGross(salesGross).tva : 0;
  const deductible = COMPANY.vatPayer ? vatFromGross(purchasesGross).tva : 0;

  addSheet(workbook, "TVA", [
    ...head("SITUAȚIA TVA"),
    COMPANY.vatPayer
      ? [`Cota ${Math.round(COMPANY.vatRate * 100)}%, prețuri cu TVA inclus (TVA = total ÷ 6).`]
      : ["Firmă neplătitoare de TVA."],
    [],
    ["", "Valoare cu TVA", "TVA"],
    ["Vânzări (net de retururi)", salesGross, collected],
    ["Cumpărări", purchasesGross, deductible],
    [],
    ["TVA de plată (colectată − deductibilă)", "", round(collected - deductible)],
  ]);

  return { workbook, filename: `Dosar_${key}_${COMPANY.name.replace(/\s+/g, "_")}.xlsx` };
}

function addSheet(workbook: XLSX.WorkBook, name: string, aoa: Cell[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const widths = aoa.reduce((max, row) => Math.max(max, row.length), 0);
  sheet["!cols"] = Array.from({ length: widths }, (_, index) => ({
    wch: index === 0 ? 6 : index <= 2 ? 14 : 22,
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName(name));
}

/** Excel refuză numele de foi peste 31 de caractere sau cu `:\/?*[]`. */
function sheetName(name: string) {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
}

function sum(rows: Cell[][], index: number) {
  return round(
    rows.reduce((total, row) => total + (typeof row[index] === "number" ? row[index] : 0), 0),
  );
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
