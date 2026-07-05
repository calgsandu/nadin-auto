import { requireCurrentAppUser } from "@/lib/auth/access";
import { canManageStaff } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { XLSX, xlsxResponse } from "@/lib/export/xlsx";

export const dynamic = "force-dynamic";

const num = (value: { toString(): string } | number | null) =>
  value == null ? "" : Number(value);

/** Backup complet al datelor de business într-un singur xlsx. Doar ADMIN. */
export async function GET() {
  const user = await requireCurrentAppUser();
  if (!canManageStaff(user.role)) {
    return new Response("Acces interzis", { status: 403 });
  }

  const [products, partners, warehouses, stocks, documents] = await Promise.all([
    prisma.product.findMany({
      include: {
        type: true,
        fitment: { include: { carModel: { include: { brand: true } } } },
      },
      orderBy: { description: "asc" },
    }),
    prisma.partner.findMany({ orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ orderBy: { name: "asc" } }),
    prisma.warehouseStock.findMany({
      where: { quantity: { not: 0 } },
      include: {
        warehouse: { select: { name: true } },
        product: { select: { externalCode: true, description: true } },
      },
      orderBy: [{ warehouse: { name: "asc" } }],
    }),
    prisma.stockDocument.findMany({
      include: {
        warehouse: { select: { name: true } },
        partner: { select: { name: true } },
        lines: {
          include: { product: { select: { externalCode: true, description: true } } },
        },
      },
      orderBy: [{ documentDate: "asc" }, { number: "asc" }],
    }),
  ]);

  const wb = XLSX.utils.book_new();
  const sheet = (name: string, aoa: (string | number)[][]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);

  sheet("Produse", [
    ["Cod", "Descriere", "Tip", "Compatibilitate", "Stoc", "Stoc minim", "Preț EUR", "Cost lei", "Preț vânzare lei"],
    ...products.map((p) => [
      p.externalCode ?? "",
      p.description,
      p.type.name,
      p.fitment.label,
      p.stock ?? 0,
      p.minStock ?? "",
      num(p.priceEuro),
      num(p.costLei),
      num(p.salePriceLei),
    ]),
  ]);

  sheet("Parteneri", [
    ["Nume", "Tip", "Telefon", "Note"],
    ...partners.map((p) => [p.name, p.kind, p.phone ?? "", p.notes ?? ""]),
  ]);

  sheet("Depozite", [
    ["Nume", "Implicit", "Activ"],
    ...warehouses.map((w) => [w.name, w.isDefault ? "DA" : "", w.active ? "DA" : "NU"]),
  ]);

  sheet("Stocuri", [
    ["Depozit", "Cod", "Produs", "Cantitate"],
    ...stocks.map((s) => [
      s.warehouse.name,
      s.product.externalCode ?? "",
      s.product.description,
      s.quantity,
    ]),
  ]);

  sheet("Documente", [
    ["Tip", "Număr", "Data", "Depozit", "Partener", "Note", "Total lei"],
    ...documents.map((d) => [
      d.type,
      d.number,
      d.documentDate.toISOString().slice(0, 10),
      d.warehouse.name,
      d.partner?.name ?? "",
      d.notes ?? "",
      num(d.totalLei ?? d.totalEuro),
    ]),
  ]);

  sheet("Linii documente", [
    ["Document", "Cod", "Produs", "Cantitate", "Preț vânzare lei", "Cost lei"],
    ...documents.flatMap((d) =>
      d.lines.map((line) => [
        `${d.type} #${d.number}`,
        line.product.externalCode ?? "",
        line.product.description,
        line.quantity,
        num(line.unitPriceEuro),
        num(line.unitCostLei),
      ]),
    ),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return xlsxResponse(wb, `backup-nadinauto-${stamp}.xlsx`);
}
