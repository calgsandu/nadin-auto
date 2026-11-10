import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/auth/access";
import { productLabelInclude } from "@/lib/catalog/product-include";
import { vehicleLabels } from "@/lib/catalog/vehicle-label";
import type { QuickIndex } from "@/lib/catalog/quick-index";
import { canViewSection } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Tot catalogul, compact, pentru paleta de comenzi (Ctrl+K): browserul îl ține
 * în memorie și caută local. Fără costuri de aducere — ecranul e adesea întors
 * spre client. ANGAJAT primește doar ce e în stoc, ca în pagina Produse.
 */
export async function GET() {
  const user = await getCurrentAppUser();
  if (!user) return new Response("Neautentificat", { status: 401 });

  const [warehouses, products, customers] = await Promise.all([
    prisma.warehouse.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      where: user.role === "ANGAJAT" ? { stock: { gt: 0 } } : undefined,
      select: {
        id: true,
        externalCode: true,
        alternativeCode: true,
        description: true,
        stock: true,
        salePriceLei: true,
        type: { select: { name: true } },
        fitment: productLabelInclude.fitment,
        productFitments: productLabelInclude.productFitments,
        warehouseStocks: { select: { warehouseId: true, quantity: true } },
      },
    }),
    canViewSection(user.role, "clienti")
      ? prisma.partner.findMany({
          where: { kind: { in: ["CUSTOMER", "BOTH"] } },
          select: { id: true, name: true, phone: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  const index: QuickIndex = {
    warehouses: warehouses.map((warehouse) => warehouse.name),
    products: products.map((product) => ({
      id: product.id,
      code: product.externalCode,
      altCode: product.alternativeCode,
      description: product.description,
      type: product.type.name,
      vehicles: vehicleLabels(product) ?? "",
      stock: product.stock ?? 0,
      stocks: warehouses.map(
        (warehouse) =>
          product.warehouseStocks.find((stock) => stock.warehouseId === warehouse.id)?.quantity ?? 0,
      ),
      price: product.salePriceLei == null ? null : Number(product.salePriceLei),
    })),
    customers,
  };

  // Fără cache HTTP: paleta ține indexul în memorie un minut și îl cere iar
  // singură — două cache-uri puse cap la cap ar arăta stocul vechi de două ori mai mult.
  return Response.json(index, { headers: { "Cache-Control": "no-store" } });
}
