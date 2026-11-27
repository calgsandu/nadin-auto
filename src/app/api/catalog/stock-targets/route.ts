import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { inventoryDocumentWhere } from "@/lib/operations/inventory-filter";
import { PRODUCT_FORM_INVENTORY_NOTE, PRODUCT_FORM_RECEIPT_NOTE } from "@/lib/catalog/product-stock-documents";

export type StockTargetDocument = {
  id: string;
  kind: "inventory" | "receipt";
  number: number;
  date: string;
  warehouseId: string;
  warehouseName: string;
  partnerName: string | null;
};

export type StockTargets = {
  suppliers: { id: string; name: string }[];
  documents: StockTargetDocument[];
};

/**
 * Ce se poate alege în fișa produsului când stocul se schimbă: furnizorii
 * (pentru marfa adusă) și ultimele inventare/recepții în care piesa poate
 * fi adăugată în loc să se deschidă un document nou.
 */
export async function GET() {
  const user = await getCurrentAppUser();
  if (!user) return new Response("Neautentificat", { status: 401 });
  if (!canWriteCatalog(user.role)) return new Response("Fără drept de scriere în catalog", { status: 403 });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const select = {
    id: true,
    number: true,
    documentDate: true,
    warehouseId: true,
    warehouse: { select: { name: true } },
    partner: { select: { name: true } },
  } as const;
  // Documentul de azi din fișe e deja opțiunea implicită („de azi din fișe").
  const notTodaysFromForm = {
    NOT: {
      notes: { in: [PRODUCT_FORM_INVENTORY_NOTE, PRODUCT_FORM_RECEIPT_NOTE] },
      documentDate: { gte: startOfToday },
    },
  };
  const order = [{ documentDate: "desc" as const }, { number: "desc" as const }];

  const [suppliers, inventories, receipts] = await Promise.all([
    prisma.partner.findMany({
      where: { kind: { in: ["SUPPLIER", "BOTH"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockDocument.findMany({ where: { ...inventoryDocumentWhere(), ...notTodaysFromForm }, select, orderBy: order, take: 30 }),
    prisma.stockDocument.findMany({ where: { type: "RECEIPT", ...notTodaysFromForm }, select, orderBy: order, take: 30 }),
  ]);

  const toTarget = (kind: StockTargetDocument["kind"]) => (document: (typeof inventories)[number]): StockTargetDocument => ({
    id: document.id,
    kind,
    number: document.number,
    date: document.documentDate.toISOString().slice(0, 10),
    warehouseId: document.warehouseId,
    warehouseName: document.warehouse.name,
    partnerName: document.partner?.name ?? null,
  });

  return Response.json({
    suppliers,
    documents: [...inventories.map(toTarget("inventory")), ...receipts.map(toTarget("receipt"))],
  } satisfies StockTargets);
}
