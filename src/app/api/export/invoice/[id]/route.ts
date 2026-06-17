import { requireCurrentAppUser } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import { XLSX, xlsxResponse } from "@/lib/export/xlsx";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Recepție",
  SALE: "Vânzare",
  RETURN: "Retur",
  ADJUSTMENT: "Ajustare",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireCurrentAppUser();
  const { id } = await params;

  const doc = await prisma.stockDocument.findUnique({
    where: { id },
    include: { warehouse: true, partner: true, lines: { include: { product: true } } },
  });
  if (!doc) return new Response("Document inexistent", { status: 404 });

  const isSale = doc.type === "SALE";
  const currency = "lei"; // both sales and receipts are tracked in lei (MDL)
  const date = new Intl.DateTimeFormat("ro-MD", { day: "2-digit", month: "2-digit", year: "numeric" }).format(doc.documentDate);

  const lineRows = doc.lines.map((line) => {
    const unit = Number((isSale ? line.unitPriceEuro : line.unitCostLei) ?? 0);
    return [line.product.externalCode ?? "", line.product.description, line.quantity, unit, unit * line.quantity];
  });
  const subtotal = lineRows.reduce((sum, r) => sum + (r[4] as number), 0);
  const TVA_RATE = 0.06; // 6%
  const tva = Math.round(subtotal * TVA_RATE * 100) / 100;
  const total = Math.round((subtotal + tva) * 100) / 100;

  const aoa: (string | number)[][] = [
    ["Nadin Auto"],
    ["Depozit și piese auto"],
    [],
    [`Factură ${TYPE_LABEL[doc.type] ?? doc.type} #${doc.number}`],
    ["Data", date],
    ["Depozit", doc.warehouse.name],
    [isSale ? "Client" : "Furnizor", doc.partner?.name ?? "—"],
    [],
    // Compatibility/product order kept consistent with the app tables.
    ["Cod", "Produs", "Cantitate", `Preț unitar (${currency})`, `Total (${currency})`],
    ...lineRows,
    [],
    ["", "", "", `Subtotal fără TVA (${currency})`, subtotal],
    ["", "", "", `TVA 6% (${currency})`, tva],
    ["", "", "", `TOTAL cu TVA (${currency})`, total],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Factură");

  return xlsxResponse(wb, `factura-${doc.type.toLowerCase()}-${doc.number}.xlsx`);
}
