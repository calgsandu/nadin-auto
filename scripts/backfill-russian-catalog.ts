import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  russianProductType,
  translateCatalogText,
} from "../src/lib/vitrina/russian-translation";

const apply = process.argv.includes("--apply");
const refresh = process.argv.includes("--refresh");

async function inBatches<T>(rows: T[], task: (row: T) => Promise<unknown>) {
  const batchSize = 40;
  for (let index = 0; index < rows.length; index += batchSize) {
    await Promise.all(rows.slice(index, index + batchSize).map(task));
  }
}

async function main() {
  const [types, fitments, products] = await Promise.all([
    prisma.productType.findMany({
      where: refresh ? undefined : { nameRu: null },
      select: { id: true, name: true },
    }),
    prisma.vehicleFitment.findMany({
      where: refresh ? undefined : { labelRu: null },
      select: { id: true, label: true },
    }),
    prisma.product.findMany({
      where: refresh
        ? undefined
        : {
            OR: [
              { descriptionRu: null },
              { notes: { not: null }, notesRu: null },
            ],
          },
      select: {
        id: true,
        description: true,
        descriptionRu: true,
        notes: true,
        notesRu: true,
      },
    }),
  ]);

  const translatedNotes = products.filter(
    (product) => product.notes && (refresh || !product.notesRu),
  ).length;
  const unresolved = new Set<string>();
  for (const type of types) {
    if (russianProductType(type.name) === type.name) unresolved.add(type.name);
  }
  for (const product of products) {
    const descriptionRu = translateCatalogText(product.description);
    if (descriptionRu === product.description) unresolved.add(product.description);
    if (product.notes) {
      const notesRu = translateCatalogText(product.notes);
      if (notesRu === product.notes) unresolved.add(product.notes);
    }
  }

  console.log(
    `${apply ? "Aplic" : "Simulez"}: ${types.length} categorii, ${fitments.length} compatibilități, ${products.length} descrieri și ${translatedNotes} note.`,
  );
  console.log(`Valori păstrate pentru revizuire manuală: ${unresolved.size}.`);
  if (unresolved.size > 0) {
    console.log([...unresolved].slice(0, 20).map((value) => `- ${value}`).join("\n"));
    if (unresolved.size > 20) console.log(`... și încă ${unresolved.size - 20}.`);
  }

  if (!apply) {
    console.log("Nicio modificare salvată. Rulează cu --apply pentru salvare.");
    return;
  }

  await inBatches(types, (type) =>
    prisma.productType.updateMany({
      where: refresh ? { id: type.id } : { id: type.id, nameRu: null },
      data: { nameRu: russianProductType(type.name) },
    }),
  );

  // Etichetele de compatibilitate conțin mărci, modele și ani, care se scriu
  // identic în ambele limbi. Le salvăm separat pentru a putea fi editate ulterior.
  await inBatches(fitments, (fitment) =>
    prisma.vehicleFitment.updateMany({
      where: refresh ? { id: fitment.id } : { id: fitment.id, labelRu: null },
      data: { labelRu: fitment.label },
    }),
  );

  await inBatches(products, (product) => {
    const data: { descriptionRu?: string; notesRu?: string } = {};
    if (refresh || !product.descriptionRu) {
      data.descriptionRu = translateCatalogText(product.description);
    }
    if (product.notes && (refresh || !product.notesRu)) {
      data.notesRu = translateCatalogText(product.notes);
    }
    return prisma.product.update({ where: { id: product.id }, data });
  });

  console.log(
    refresh
      ? "Traducerile ruse generate au fost regenerate."
      : "Traducerile ruse au fost salvate fără a suprascrie editările existente.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
