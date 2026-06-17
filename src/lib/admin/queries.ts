import { prisma } from "@/lib/prisma";

/** Data for the catalog-admin sections (brands, models, types, fitments, warehouses). */
export async function getCatalogAdminData() {
  const [brands, models, types, fitments, warehouses] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { models: true } } },
    }),
    prisma.carModel.findMany({
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
      include: { brand: true, _count: { select: { fitments: true } } },
    }),
    prisma.productType.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.vehicleFitment.findMany({
      orderBy: [{ carModel: { name: "asc" } }, { label: "asc" }],
      include: {
        carModel: { include: { brand: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.warehouse.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { stocks: true, documents: true } } },
    }),
  ]);

  return { brands, models, types, fitments, warehouses };
}

export type CatalogAdminData = Awaited<ReturnType<typeof getCatalogAdminData>>;
export type BrandRow = CatalogAdminData["brands"][number];
export type ModelRow = CatalogAdminData["models"][number];
export type TypeRow = CatalogAdminData["types"][number];
export type FitmentRow = CatalogAdminData["fitments"][number];
export type WarehouseRow = CatalogAdminData["warehouses"][number];
