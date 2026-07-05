import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { COMPANY, vatFromGross } from "@/lib/company";
import { XLSX, xlsxResponse } from "@/lib/export/xlsx";
import {
  createPdf,
  drawDocumentHeader,
  drawTable,
  pdfMoney,
  pdfResponse,
  type PdfColumn,
} from "@/lib/export/pdf";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

type RegisterRow = {
  date: Date;
  document: string;
  buyer: string;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  value: number;
};

/**
 * Registrul de evidență a vânzărilor — produsele vândute în formă tabelară,
 * cu prețuri TVA inclus (cota standard 20%, TVA = valoare ÷ 6), conform
 * practicii de evidență fiscală din Republica Moldova. Retururile apar cu
 * cantitate/valoare negativă.
 */
export async function GET(request: Request) {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    return new Response("Acces interzis", { status: 403 });
  }

  const url = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = parseDate(url.searchParams.get("from"), defaultFrom);
  const toRaw = parseDate(url.searchParams.get("to"), now);
  const to = new Date(toRaw);
  to.setHours(23, 59, 59, 999);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";

  const documents = await prisma.stockDocument.findMany({
    where: {
      type: { in: ["SALE", "RETURN"] },
      documentDate: { gte: from, lte: to },
    },
    include: {
      partner: { select: { name: true } },
      lines: { include: { product: { select: { description: true, externalCode: true } } } },
    },
    orderBy: [{ documentDate: "asc" }, { number: "asc" }],
  });

  const rows: RegisterRow[] = documents.flatMap((doc) => {
    const sign = doc.type === "RETURN" ? -1 : 1;
    const label = doc.type === "RETURN" ? `Retur #${doc.number}` : `Vânzare #${doc.number}`;
    return doc.lines.map((line) => {
      const unit = Number(line.unitPriceEuro ?? 0);
      return {
        date: doc.documentDate,
        document: label,
        buyer: doc.partner?.name ?? "Consumator final",
        code: line.product.externalCode ?? "—",
        description: line.product.description,
        quantity: sign * line.quantity,
        unitPrice: unit,
        value: sign * unit * line.quantity,
      };
    });
  });

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const { tva, net } = vatFromGross(totalValue);

  const period = `${dateFmt.format(from)} — ${dateFmt.format(to)}`;
  const stamp = `${from.toISOString().slice(0, 10)}_${toRaw.toISOString().slice(0, 10)}`;

  if (format === "xlsx") {
    const header = [
      "Nr. crt.",
      "Data",
      "Document",
      "Cumpărător",
      "Cod",
      "Denumirea mărfii",
      "U.M.",
      "Cantitatea",
      "Preț unitar (lei)",
      "Valoarea (lei)",
      "incl. TVA (lei)",
    ];
    const aoa: (string | number)[][] = [
      [COMPANY.legalName],
      [`IDNO: ${COMPANY.idno} · ${COMPANY.address}`],
      [],
      [`REGISTRUL DE EVIDENȚĂ A VÂNZĂRILOR — perioada ${period}`],
      COMPANY.vatPayer
        ? ["Prețurile includ TVA 20% (TVA calculat = valoarea ÷ 6)."]
        : ["Firmă neplătitoare de TVA."],
      [],
      header,
      ...rows.map((row, index) => [
        index + 1,
        dateFmt.format(row.date),
        row.document,
        row.buyer,
        row.code,
        row.description,
        "buc.",
        row.quantity,
        row.unitPrice,
        Math.round(row.value * 100) / 100,
        COMPANY.vatPayer ? Math.round((row.value / 6) * 100) / 100 : "",
      ]),
      [],
      [
        "", "", "", "", "", "TOTAL", "",
        totalQuantity, "",
        Math.round(totalValue * 100) / 100,
        COMPANY.vatPayer ? tva : "",
      ],
      ...(COMPANY.vatPayer
        ? [["", "", "", "", "", "Valoarea fără TVA", "", "", "", net, ""]]
        : []),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 7 },
      { wch: 11 },
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 44 },
      { wch: 6 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registru vânzări");
    return xlsxResponse(wb, `registru-vanzari-${stamp}.xlsx`);
  }

  const pdf = createPdf();
  drawDocumentHeader(
    pdf,
    COMPANY,
    "REGISTRUL DE EVIDENȚĂ A VÂNZĂRILOR",
    `perioada ${period}${COMPANY.vatPayer ? " · prețuri cu TVA 20% inclus" : " · firmă neplătitoare de TVA"}`,
  );

  const columns: PdfColumn[] = [
    { header: "Nr.", width: 24, align: "center" },
    { header: "Data", width: 52 },
    { header: "Document", width: 58 },
    { header: "Cumpărător", width: 74 },
    { header: "Cod", width: 52 },
    { header: "Denumirea mărfii", width: 128 },
    { header: "Cant.", width: 32, align: "right" },
    { header: "Preț (lei)", width: 47, align: "right" },
    { header: "Valoare (lei)", width: 48, align: "right" },
  ];

  const tableRows = rows.map((row, index) => [
    String(index + 1),
    dateFmt.format(row.date),
    row.document,
    row.buyer,
    row.code,
    row.description,
    String(row.quantity),
    pdfMoney.format(row.unitPrice),
    pdfMoney.format(row.value),
  ]);
  tableRows.push(
    ["", "", "", "", "", "TOTAL", String(totalQuantity), "", pdfMoney.format(totalValue)],
  );
  const boldRow = tableRows.length - 1;
  if (COMPANY.vatPayer) {
    tableRows.push(
      ["", "", "", "", "", "din care TVA (÷6)", "", "", pdfMoney.format(tva)],
      ["", "", "", "", "", "Valoarea fără TVA", "", "", pdfMoney.format(net)],
    );
  }

  drawTable(pdf, columns, tableRows, {
    boldRows: new Set([boldRow]),
    fontSize: 8,
  });

  pdf.moveDown(2);
  pdf
    .font("regular")
    .fontSize(9)
    .fillColor("#1b1a17")
    .text("Întocmit: ______________________", pdf.page.margins.left, pdf.y);

  return pdfResponse(pdf, `registru-vanzari-${stamp}.pdf`);
}
