import { prisma } from "@/lib/prisma";

export type BrowseOption = { id: string; name: string; count: number };

/**
 * Opțiunile de răsfoire din pagina de start: mărcile, modelele mărcii alese și
 * tipurile, fiecare cu numărul de produse. Se numără după mașina principală a
 * produsului — destul ca să ordoneze butoanele; filtrul propriu-zis (din
 * `buildProductWhere`) prinde și compatibilitățile suplimentare.
 */
export async function getBrowseOptions(brandId?: string) {
  const [brands, models, types] = await Promise.all([
    prisma.$queryRaw<BrowseOption[]>`
      SELECT b.id, b.name, COUNT(p.id)::int AS count
      FROM "Brand" b
      JOIN "CarModel" m ON m."brandId" = b.id
      JOIN "VehicleFitment" f ON f."carModelId" = m.id
      JOIN "Product" p ON p."fitmentId" = f.id
      GROUP BY b.id, b.name
      ORDER BY count DESC, b.name ASC`,
    brandId
      ? prisma.$queryRaw<BrowseOption[]>`
          SELECT m.id, m.name, COUNT(p.id)::int AS count
          FROM "CarModel" m
          JOIN "VehicleFitment" f ON f."carModelId" = m.id
          JOIN "Product" p ON p."fitmentId" = f.id
          WHERE m."brandId" = ${brandId}
          GROUP BY m.id, m.name
          ORDER BY m.name ASC`
      : Promise.resolve([] as BrowseOption[]),
    prisma.$queryRaw<BrowseOption[]>`
      SELECT t.id, t.name, COUNT(p.id)::int AS count
      FROM "ProductType" t
      JOIN "Product" p ON p."typeId" = t.id
      GROUP BY t.id, t.name
      ORDER BY count DESC, t.name ASC`,
  ]);

  return { brands, models, types };
}
