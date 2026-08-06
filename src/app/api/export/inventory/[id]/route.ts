import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { XLSX, xlsxResponse } from "@/lib/export/xlsx";
import { createPdf, drawDocumentHeader, drawTable, pdfResponse, type PdfColumn } from "@/lib/export/pdf";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Proces-verbal de inventariere: pozițiile ajustate, cu diferența semnată. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    return new Response("Acces interzis", { status: 403 });
  }

  const { id } = await params;
  const doc = await prisma.stockDocument.findUnique({
    where: { id },
    include: {
      warehouse: { select: { name: true } },
      lines: {
        include: { product: { select: { description: true, externalCode: true } } },
      },
    },
  });
  if (!doc || doc.type !== "ADJUSTMENT") {
    return new Response("Inventar inexistent", { status: 404 });
  }

  const date = dateFormat.format(doc.documentDate);
  const rows = doc.lines.map((line, index) => ({
    index: index + 1,
    code: line.product?.externalCode ?? line.externalCode ?? "—",
    name: line.product?.description ?? line.externalName ?? "Piesă externă",
    diff: line.quantity,
  }));
  const plus = rows.reduce((sum, row) => sum + (row.diff > 0 ? row.diff : 0), 0);
  const minus = rows.reduce((sum, row) => sum + (row.diff < 0 ? row.diff : 0), 0);
  const title = `PROCES-VERBAL DE INVENTARIERE nr. ${doc.number}`;
  const filename = `inventar-${doc.number}-${doc.documentDate.toISOString().slice(0, 10)}`;

  if (new URL(request.url).searchParams.get("format") === "pdf") {
    const pdf = createPdf();
    drawDocumentHeader(pdf, COMPANY, title, `din ${date}`);
    pdf.font("regular").fontSize(9).fillColor("#1b1a17");
    pdf.text(`Depozit: ${doc.warehouse.name}`);
    pdf.text(`Notițe: ${doc.notes || "—"}`);
    pdf.moveDown(1);

    const columns: PdfColumn[] = [
      { header: "Nr.", width: 30 },
      { header: "Cod", width: 85 },
      { header: "Produs", width: 275 },
      { header: "Diferență", width: 65, align: "right" },
    ];
    drawTable(
      pdf,
      columns,
      rows.map((row) => [String(row.index), row.code, row.name, signed(row.diff)]),
    );

    pdf.moveDown(1);
    pdf.font("bold").fontSize(9);
    pdf.text(`Plusuri: ${signed(plus)} buc · Minusuri: ${signed(minus)} buc · Net: ${signed(plus + minus)} buc`);
    pdf.moveDown(2.5);
    pdf.font("regular").fontSize(9).fillColor("#6f6b63");
    pdf.text("A numărat: ______________________          A verificat: ______________________");

    return pdfResponse(pdf, `${filename}.pdf`);
  }

  const aoa: (string | number)[][] = [
    [`${COMPANY.legalName} — ${title}`],
    [],
    ["Data:", date],
    ["Depozit:", doc.warehouse.name],
    ["Notițe:", doc.notes || "—"],
    [],
    ["Nr.", "Cod", "Produs", "Diferență (buc)"],
    ...rows.map((row) => [row.index, row.code, row.name, row.diff]),
    [],
    ["", "", "Plusuri", plus],
    ["", "", "Minusuri", minus],
    ["", "", "Net", plus + minus],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 5 }, { wch: 16 }, { wch: 50 }, { wch: 16 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 6, c: 0 }, e: { r: 6 + rows.length, c: 3 } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventar");
  return xlsxResponse(wb, `${filename}.xlsx`);
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
