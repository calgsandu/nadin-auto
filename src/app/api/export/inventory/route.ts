import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { XLSX, xlsxResponse } from "@/lib/export/xlsx";
import { createPdf, drawDocumentHeader, drawTable, pdfResponse, type PdfColumn } from "@/lib/export/pdf";
import { inventoryWhere } from "@/lib/operations/inventory-filter";

export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Registrul inventarelor unui depozit pe o perioadă (toate documentele într-un fișier). */
export async function GET(request: Request) {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    return new Response("Acces interzis", { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const warehouseId = searchParams.get("wh") ?? "";
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const warehouse = warehouseId
    ? await prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { name: true } })
    : null;
  if (!warehouse) return new Response("Depozit inexistent", { status: 404 });

  const documents = await prisma.stockDocument.findMany({
    where: inventoryWhere({ warehouseId, from, to }),
    include: {
      lines: { include: { product: { select: { description: true, externalCode: true } } } },
    },
    orderBy: [{ documentDate: "asc" }, { number: "asc" }],
  });

  const rows = documents.flatMap((doc) =>
    doc.lines.map((line) => ({
      date: dateFormat.format(doc.documentDate),
      number: doc.number,
      code: line.product?.externalCode ?? line.externalCode ?? "—",
      name: line.product?.description ?? line.externalName ?? "Piesă externă",
      diff: line.quantity,
    })),
  );
  const plus = rows.reduce((sum, row) => sum + (row.diff > 0 ? row.diff : 0), 0);
  const minus = rows.reduce((sum, row) => sum + (row.diff < 0 ? row.diff : 0), 0);

  const period = from || to ? `${from ? dateFormat.format(new Date(`${from}T00:00:00`)) : "început"} – ${to ? dateFormat.format(new Date(`${to}T00:00:00`)) : "azi"}` : "toată perioada";
  const title = `REGISTRUL INVENTARELOR — ${warehouse.name}`;
  const filename = `inventare-${slug(warehouse.name)}-${from ?? "inceput"}_${to ?? "azi"}`;

  if (searchParams.get("format") === "pdf") {
    const pdf = createPdf();
    drawDocumentHeader(pdf, COMPANY, title, `Perioada: ${period}`);
    pdf.font("regular").fontSize(9).fillColor("#1b1a17");
    pdf.text(`Inventare: ${documents.length} · Poziții ajustate: ${rows.length}`);
    pdf.moveDown(1);

    const columns: PdfColumn[] = [
      { header: "Data", width: 60 },
      { header: "Inventar", width: 55 },
      { header: "Cod", width: 80 },
      { header: "Produs", width: 205 },
      { header: "Diferență", width: 60, align: "right" },
    ];
    drawTable(
      pdf,
      columns,
      rows.map((row) => [row.date, `#${row.number}`, row.code, row.name, signed(row.diff)]),
    );

    pdf.moveDown(1);
    pdf.font("bold").fontSize(9);
    pdf.text(`Plusuri: ${signed(plus)} buc · Minusuri: ${signed(minus)} buc · Net: ${signed(plus + minus)} buc`);

    return pdfResponse(pdf, `${filename}.pdf`);
  }

  const aoa: (string | number)[][] = [
    [`${COMPANY.legalName} — ${title}`],
    [],
    ["Perioada:", period],
    ["Inventare:", documents.length],
    [],
    ["Data", "Inventar", "Cod", "Produs", "Diferență (buc)"],
    ...rows.map((row) => [row.date, `#${row.number}`, row.code, row.name, row.diff]),
    [],
    ["", "", "", "Plusuri", plus],
    ["", "", "", "Minusuri", minus],
    ["", "", "", "Net", plus + minus],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 50 }, { wch: 16 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + rows.length, c: 4 } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventare");
  return xlsxResponse(wb, `${filename}.xlsx`);
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
