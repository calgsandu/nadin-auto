import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { COMPANY, vatFromGross } from "@/lib/company";
import {
  createPdf,
  drawDocumentHeader,
  drawTable,
  pdfMoney,
  pdfResponse,
  type PdfColumn,
} from "@/lib/export/pdf";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "FACTURĂ DE RECEPȚIE",
  SALE: "FACTURĂ DE VÂNZARE",
  RETURN: "DOCUMENT DE RETUR",
  ADJUSTMENT: "ACT DE AJUSTARE / TRANSFER",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    return new Response("Acces interzis", { status: 403 });
  }
  const { id } = await params;

  const doc = await prisma.stockDocument.findUnique({
    where: { id },
    include: { warehouse: true, partner: true, lines: { include: { product: true } } },
  });
  if (!doc) return new Response("Document inexistent", { status: 404 });

  const isOutgoing = doc.type === "SALE" || doc.type === "RETURN";
  const date = new Intl.DateTimeFormat("ro-MD", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(doc.documentDate);

  const pdf = createPdf();

  drawDocumentHeader(
    pdf,
    COMPANY,
    `${TYPE_LABEL[doc.type] ?? doc.type} nr. ${doc.number}`,
    `din ${date}`,
  );

  // Party details.
  pdf.font("regular").fontSize(9).fillColor("#1b1a17");
  pdf.text(`Depozit: ${doc.warehouse.name}`);
  pdf.text(
    `${isOutgoing ? "Cumpărător" : "Furnizor"}: ${doc.partner?.name ?? "Consumator final"}` +
      (doc.partner?.phone ? ` · tel. ${doc.partner.phone}` : ""),
  );
  if (doc.notes) pdf.text(`Mențiuni: ${doc.notes}`);
  pdf.moveDown(0.8);

  const columns: PdfColumn[] = [
    { header: "Nr.", width: 26, align: "center" },
    { header: "Cod", width: 70 },
    { header: "Denumirea mărfii", width: 215 },
    { header: "U.M.", width: 32, align: "center" },
    { header: "Cant.", width: 40, align: "right" },
    { header: "Preț unitar (lei)", width: 66, align: "right" },
    { header: "Valoarea (lei)", width: 66, align: "right" },
  ];

  let total = 0;
  const rows = doc.lines.map((line, index) => {
    const unit = Number((isOutgoing ? line.unitPriceEuro : line.unitCostLei) ?? 0);
    const value = unit * line.quantity;
    total += value;
    return [
      String(index + 1),
      line.product.externalCode ?? "—",
      line.product.description,
      "buc.",
      String(line.quantity),
      pdfMoney.format(unit),
      pdfMoney.format(value),
    ];
  });

  if (COMPANY.vatPayer) {
    const { tva, net } = vatFromGross(total);
    rows.push(
      ["", "", "", "", "", "Fără TVA", pdfMoney.format(net)],
      ["", "", "", "", "", `TVA (${COMPANY.vatRate * 100}%)`, pdfMoney.format(tva)],
    );
  }
  rows.push(["", "", "", "", "", "TOTAL", pdfMoney.format(total)]);

  drawTable(pdf, columns, rows, {
    boldRows: new Set([rows.length - 1]),
  });

  // Signature block.
  pdf.moveDown(2.5);
  const y = pdf.y;
  pdf.font("regular").fontSize(9).fillColor("#1b1a17");
  pdf.text("Predat: ______________________", pdf.page.margins.left, y);
  pdf.text("Primit: ______________________", 330, y);

  const stamp = doc.documentDate.toISOString().slice(0, 10);
  return pdfResponse(pdf, `${doc.type.toLowerCase()}-${doc.number}-${stamp}.pdf`);
}
