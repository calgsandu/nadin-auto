import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { XLSX, xlsxResponse } from "@/lib/export/xlsx";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Recepție",
  SALE: "Vânzare",
  RETURN: "Retur",
  ADJUSTMENT: "Ajustare",
};

const MONEY_FORMAT = "#,##0.00";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireCurrentAppUser();
  const { id } = await params;

  const doc = await prisma.stockDocument.findUnique({
    where: { id },
    include: { warehouse: true, partner: true, lines: { include: { product: true } } },
  });
  if (!doc) return new Response("Document inexistent", { status: 404 });

  const isOutgoing = doc.type === "SALE" || doc.type === "RETURN";

  // Recepțiile/ajustările conțin costuri de aducere — doar ADMIN/DIRECTOR.
  if (!isOutgoing && !canWriteCatalog(user.role)) {
    return new Response("Acces interzis", { status: 403 });
  }
  const date = new Intl.DateTimeFormat("ro-MD", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(doc.documentDate);

  const lineRows = doc.lines.map((line, index) => {
    const unit = Number((isOutgoing ? line.unitPriceEuro : line.unitCostLei) ?? 0);
    return [
      index + 1,
      line.product?.externalCode ?? line.externalCode ?? (line.product ? "" : "extern"),
      line.product?.description ?? line.externalName ?? "Piesă externă",
      line.quantity,
      unit,
      unit * line.quantity,
    ];
  });

  // Prices are VAT-inclusive: TVA = total ÷ 6, "fără TVA" = total − TVA.
  const total = lineRows.reduce((sum, r) => sum + (r[5] as number), 0);
  const tva = Math.round((total / 6) * 100) / 100;
  const faraTva = Math.round((total - tva) * 100) / 100;

  const headerRow = ["Nr.", "Cod", "Produs", "Cantitate", "Preț unitar (lei)", "Valoare (lei)"];
  const vatRows: (string | number)[][] = COMPANY.vatPayer
    ? [
        ["", "", "", "", "Fără TVA (lei)", faraTva],
        ["", "", "", "", "TVA (lei)", tva],
      ]
    : [];
  const paymentRows: (string | number)[][] =
    doc.type === "SALE"
      ? [["Metoda de plată:", salePaymentMethodLabel(doc.paymentMethod)]]
      : [];
  const aoa: (string | number)[][] = [
    ["NADIN AUTO — DOCUMENT INTERN"],
    [],
    [`Fișă internă de ${TYPE_LABEL[doc.type]?.toLowerCase() ?? doc.type} nr. ${doc.number} din ${date}`],
    [],
    ["Depozit:", doc.warehouse.name],
    [isOutgoing ? "Client:" : "Furnizor:", doc.partner?.name ?? "Consumator final"],
    ...paymentRows,
    ["Telefon:", doc.partner?.phone ?? "—"],
    ["Notițe:", doc.notes || "—"],
    [],
    headerRow,
    ...lineRows,
    [],
    ...vatRows,
    ["", "", "", "", "TOTAL (lei)", total],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 46 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
  ];

  // Number formats on money cells (prices, values, totals).
  const firstLineRow = 10 + paymentRows.length; // 0-indexed row of the first product line
  for (let r = firstLineRow; r < firstLineRow + lineRows.length; r += 1) {
    for (const c of [4, 5]) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = MONEY_FORMAT;
    }
  }
  const totalsRowCount = vatRows.length + 1;
  for (let r = firstLineRow + lineRows.length + 1; r <= firstLineRow + lineRows.length + totalsRowCount; r += 1) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
    if (cell) cell.z = MONEY_FORMAT;
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Document intern");

  const stamp = doc.documentDate.toISOString().slice(0, 10);
  return xlsxResponse(wb, `document-intern-${doc.type.toLowerCase()}-${doc.number}-${stamp}.xlsx`);
}
