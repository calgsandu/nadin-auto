import { prisma } from "@/lib/prisma";

export type CatalogAdminSection =
  | "branduri"
  | "modele"
  | "tipuri"
  | "compatibilitati"
  | "depozite";

/**
 * Datele pentru o secțiune de administrare a catalogului.
 *
 * Forma e aceeași pentru toate secțiunile, dar se citește doar ce afișează
 * secțiunea cerută (plus lista de care are nevoie dialogul ei): înainte,
 * deschiderea oricăreia aducea toate cele cinci seturi — inclusiv cele 292 de
 * compatibilități cu modelul și brandul lor, ~256 KB degeaba.
 */
export async function getCatalogAdminData(section: CatalogAdminSection = "branduri") {
  // Compatibilitățile le cer pentru dialogul de model deschis din interiorul lor
  // (lanțul brand → model → compatibilitate, fără să părăsești formularul).
  const needBrands =
    section === "branduri" || section === "modele" || section === "compatibilitati";
  const needModels = section === "modele" || section === "compatibilitati";

  const [brands, models, types, fitments, warehouses] = await Promise.all([
    needBrands
      ? prisma.brand.findMany({
          orderBy: { name: "asc" },
          include: { _count: { select: { models: true } } },
        })
      : Promise.resolve([]),
    needModels
      ? prisma.carModel.findMany({
          orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
          include: { brand: true, _count: { select: { fitments: true } } },
        })
      : Promise.resolve([]),
    section === "tipuri"
      ? prisma.productType.findMany({
          orderBy: { name: "asc" },
          include: { _count: { select: { products: true } } },
        })
      : Promise.resolve([]),
    section === "compatibilitati"
      ? prisma.vehicleFitment.findMany({
          orderBy: [{ carModel: { name: "asc" } }, { label: "asc" }],
          include: {
            carModel: { include: { brand: true } },
            _count: { select: { products: true } },
          },
        })
      : Promise.resolve([]),
    section === "depozite"
      ? prisma.warehouse.findMany({
          orderBy: { name: "asc" },
          include: { _count: { select: { stocks: true, documents: true } } },
        })
      : Promise.resolve([]),
  ]);

  return { brands, models, types, fitments, warehouses };
}

export type CatalogAdminData = Awaited<ReturnType<typeof getCatalogAdminData>>;
export type BrandRow = CatalogAdminData["brands"][number];
export type ModelRow = CatalogAdminData["models"][number];
export type TypeRow = CatalogAdminData["types"][number];
export type FitmentRow = CatalogAdminData["fitments"][number];
export type WarehouseRow = CatalogAdminData["warehouses"][number];
