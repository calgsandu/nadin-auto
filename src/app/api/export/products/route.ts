import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { XLSX, xlsxResponse } from "@/lib/export/xlsx";

export const dynamic = "force-dynamic";

const MONEY_FORMAT = "#,##0.00";

export async function GET() {
  const user = await requireCurrentAppUser();
  const canViewCost = canWriteCatalog(user.role); // ADMIN / DIRECTOR only

  const [products, warehouseStocks] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ fitment: { carModel: { brand: { name: "asc" } } } }, { description: "asc" }],
      include: {
        type: true,
        fitment: { include: { carModel: { include: { brand: true } } } },
      },
    }),
    prisma.warehouseStock.findMany({
      where: { quantity: { not: 0 } },
      include: { warehouse: true, product: { select: { externalCode: true, description: true } } },
      orderBy: [{ warehouse: { name: "asc" } }, { product: { description: "asc" } }],
    }),
  ]);

  // Compatibility before the product, per requirement; cost columns ADMIN/DIRECTOR only.
  const header = [
    "Cod",
    "Compatibilitate",
    "Brand",
    "Model",
    "Produs",
    "Tip",
    "Stoc",
    "Preț vânzare (lei)",
    ...(canViewCost ? ["Cost aducere (lei)", "Preț EUR", "Valoare stoc (lei)"] : []),
  ];
  const rows = products.map((p) => {
    const stock = p.stock ?? 0;
    const cost = p.costLei != null ? Number(p.costLei) : null;
    return [
      p.externalCode ?? "",
      p.fitment.label,
      p.fitment.carModel.brand.name,
      p.fitment.carModel.name,
      p.description,
      p.type.name,
      stock,
      p.salePriceLei != null ? Number(p.salePriceLei) : "",
      ...(canViewCost
        ? [cost ?? "", p.priceEuro != null ? Number(p.priceEuro) : "", cost != null ? cost * stock : ""]
        : []),
    ];
  });

  const totalStock = products.reduce((sum, p) => sum + (p.stock ?? 0), 0);
  const totalValue = products.reduce(
    (sum, p) => sum + (p.costLei != null ? Number(p.costLei) * (p.stock ?? 0) : 0),
    0,
  );
  const totalsRow: (string | number)[] = ["TOTAL", "", "", "", "", "", totalStock, ""];
  if (canViewCost) totalsRow.push("", "", totalValue);

  const stamp = new Date().toISOString().slice(0, 10);
  const aoa = [
    [`NADIN AUTO — Catalog produse (${stamp})`],
    [],
    header,
    ...rows,
    [],
    totalsRow,
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 44 }, { wch: 16 },
    { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 16 },
  ];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];
  ws["!autofilter"] = {
    ref: `A3:${XLSX.utils.encode_cell({ r: 2 + rows.length, c: header.length - 1 })}`,
  };

  const moneyCols = canViewCost ? [7, 8, 9, 10] : [7];
  for (let r = 3; r < 3 + rows.length; r += 1) {
    for (const c of moneyCols) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === "number") cell.z = MONEY_FORMAT;
    }
  }
  const totalValueCell = ws[XLSX.utils.encode_cell({ r: 4 + rows.length, c: 10 })];
  if (totalValueCell && typeof totalValueCell.v === "number") totalValueCell.z = MONEY_FORMAT;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produse");

  // Second sheet: per-warehouse stock, so the split across pavilions is explicit.
  const stockRows = warehouseStocks.map((s) => ({
    Depozit: s.warehouse.name,
    Cod: s.product.externalCode ?? "",
    Produs: s.product.description,
    Cantitate: s.quantity,
  }));
  const wsStock = XLSX.utils.json_to_sheet(stockRows);
  wsStock["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 44 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsStock, "Stoc pe depozite");

  return xlsxResponse(wb, `produse-${stamp}.xlsx`);
}
