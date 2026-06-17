import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { XLSX, xlsxResponse } from "@/lib/export/xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireCurrentAppUser();
  const canViewCost = canWriteCatalog(user.role); // ADMIN / DIRECTOR only

  const products = await prisma.product.findMany({
    orderBy: [{ fitment: { carModel: { brand: { name: "asc" } } } }, { description: "asc" }],
    include: {
      type: true,
      fitment: { include: { carModel: { include: { brand: true } } } },
    },
  });

  // Compatibility before the product, per requirement; cost columns ADMIN/DIRECTOR only.
  const rows = products.map((p) => {
    const row: Record<string, string | number> = {
      Cod: p.externalCode ?? "",
      Compatibilitate: p.fitment.label,
      Brand: p.fitment.carModel.brand.name,
      Model: p.fitment.carModel.name,
      Produs: p.description,
      Tip: p.type.name,
      Stoc: p.stock ?? 0,
      "Preț vânzare (lei)": p.salePriceLei != null ? Number(p.salePriceLei) : "",
    };
    if (canViewCost) {
      row["Cost aducere (lei)"] = p.costLei != null ? Number(p.costLei) : "";
      row["Preț EUR"] = p.priceEuro != null ? Number(p.priceEuro) : "";
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 40 }, { wch: 16 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 10 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produse");

  const stamp = new Date().toISOString().slice(0, 10);
  return xlsxResponse(wb, `produse-${stamp}.xlsx`);
}
