import "dotenv/config";
import { prisma } from "@/lib/prisma";

// ponytail: leagă piesele la modelele-geamăn (badge engineering) prin ProductFitment.
// Gemeni identici → toate tipurile; gemeni parțiali (front diferit) → doar tipuri de caroserie laterală/spate.
// Dry-run implicit; --apply scrie.

const APPLY = process.argv.includes("--apply");

const SAFE_BODY_TYPES = [
  "Prag", "Panou", "Arcă", "Jgheab", "Scară", "Podea", "Etanșant", "Prag + arcă",
];

type TwinSpec = {
  // fitmenturi sursă: toate fitmenturile modelului sursă care încep cu prefixul de ani dat (sau toate)
  sourceBrand: string;
  sourceModel: string;
  sourceLabelLike?: string; // filtru LIKE pe label
  twins: Array<{ brand: string; model: string; label: string; yearStart: number | null; yearEnd: number | null; open?: boolean }>;
  types?: string[]; // undefined = toate
};

const SPECS: TwinSpec[] = [
  {
    sourceBrand: "FIAT", sourceModel: "SCUDO",
    twins: [
      { brand: "PEUGEOT", model: "EXPERT", label: "PEUGEOT EXPERT /95-07/", yearStart: 1995, yearEnd: 2007 },
      { brand: "CITROEN", model: "JUMPY", label: "CITROEN JUMPY /95-07/", yearStart: 1995, yearEnd: 2007 },
    ],
  },
  {
    sourceBrand: "FIAT", sourceModel: "DUCATO II",
    twins: [
      { brand: "PEUGEOT", model: "BOXER", label: "PEUGEOT BOXER /94-06/", yearStart: 1994, yearEnd: 2006 },
      { brand: "CITROEN", model: "JUMPER", label: "CITROEN JUMPER /94-06/", yearStart: 1994, yearEnd: 2006 },
    ],
  },
  {
    sourceBrand: "FIAT", sourceModel: "DUCATO III",
    twins: [
      { brand: "PEUGEOT", model: "BOXER", label: "PEUGEOT BOXER /06+/", yearStart: 2006, yearEnd: null, open: true },
      { brand: "CITROEN", model: "JUMPER", label: "CITROEN JUMPER /06+/", yearStart: 2006, yearEnd: null, open: true },
    ],
  },
  {
    sourceBrand: "OPEL", sourceModel: "VIVARO",
    twins: [
      { brand: "RENAULT", model: "TRAFIC", label: "RENAULT TRAFIC /01-14/", yearStart: 2001, yearEnd: 2014 },
      { brand: "NISSAN", model: "PRIMASTAR", label: "NISSAN PRIMASTAR /01-14/", yearStart: 2001, yearEnd: 2014 },
    ],
  },
  {
    sourceBrand: "RENAULT", sourceModel: "MASTER", sourceLabelLike: "%/98-10/%",
    twins: [{ brand: "OPEL", model: "MOVANO", label: "OPEL MOVANO /98-10/", yearStart: 1998, yearEnd: 2010 }],
  },
  {
    sourceBrand: "RENAULT", sourceModel: "MASTER", sourceLabelLike: "%/10-24/%",
    twins: [{ brand: "OPEL", model: "MOVANO", label: "OPEL MOVANO /10-21/", yearStart: 2010, yearEnd: 2021 }],
  },
  {
    sourceBrand: "FORD", sourceModel: "GALAXY",
    twins: [
      { brand: "VOLKSWAGEN", model: "SHARAN", label: "VW SHARAN /95-10/", yearStart: 1995, yearEnd: 2010 },
      { brand: "SEAT", model: "ALHAMBRA", label: "SEAT ALHAMBRA /96-10/", yearStart: 1996, yearEnd: 2010 },
    ],
    types: SAFE_BODY_TYPES,
  },
  {
    sourceBrand: "CITROEN", sourceModel: "BERLINGO", sourceLabelLike: "%/96-10/%",
    twins: [{ brand: "PEUGEOT", model: "PARTNER", label: "PEUGEOT PARTNER /96-10/", yearStart: 1996, yearEnd: 2010 }],
    types: SAFE_BODY_TYPES,
  },
  {
    sourceBrand: "CITROEN", sourceModel: "BERLINGO", sourceLabelLike: "%/08-18/%",
    twins: [{ brand: "PEUGEOT", model: "PARTNER", label: "PEUGEOT PARTNER /08-18/", yearStart: 2008, yearEnd: 2018 }],
    types: SAFE_BODY_TYPES,
  },
  {
    // LT 35/45 = geamănul Sprinter W901-905 (fața diferă) — legăm DOAR caroseria laterală/spate
    sourceBrand: "MERCEDES-BENZ", sourceModel: "SPRINTER",
    twins: [{ brand: "VOLKSWAGEN", model: "LT 35/45", label: "VOLKSWAGEN LT 35/45 1995-2006", yearStart: 1995, yearEnd: 2006 }],
    types: SAFE_BODY_TYPES,
  },
  {
    // Crafter 2E = geamănul Sprinter W906 (fața diferă)
    sourceBrand: "MERCEDES-BENZ", sourceModel: "SPRINTER 906 (DELFIN)",
    twins: [{ brand: "VOLKSWAGEN", model: "CRAFTER", label: "VW CRAFTER /06-16/", yearStart: 2006, yearEnd: 2016 }],
    types: SAFE_BODY_TYPES,
  },
];

async function main() {
  let totalLinks = 0;
  for (const spec of SPECS) {
    const sourceProducts = await prisma.product.findMany({
      where: {
        OR: [
          { fitment: { carModel: { name: spec.sourceModel, brand: { name: spec.sourceBrand } } } },
          { productFitments: { some: { fitment: { carModel: { name: spec.sourceModel, brand: { name: spec.sourceBrand } } } } } },
        ],
        ...(spec.sourceLabelLike ? { fitment: { label: { contains: spec.sourceLabelLike.replaceAll("%", "") } } } : {}),
        ...(spec.types ? { type: { name: { in: spec.types } } } : {}),
      },
      select: { id: true, description: true, type: { select: { name: true } } },
    });
    if (sourceProducts.length === 0) {
      console.log(`(nimic) ${spec.sourceBrand} ${spec.sourceModel} ${spec.sourceLabelLike ?? ""}`);
      continue;
    }
    for (const twin of spec.twins) {
      console.log(`${spec.sourceBrand} ${spec.sourceModel} → ${twin.brand} ${twin.model} (${twin.label}): ${sourceProducts.length} piese`);
      totalLinks += sourceProducts.length;
      if (!APPLY) continue;
      const brand = await prisma.brand.upsert({ where: { name: twin.brand }, create: { name: twin.brand }, update: {} });
      const model = await prisma.carModel.upsert({
        where: { brandId_name: { brandId: brand.id, name: twin.model } },
        create: { brandId: brand.id, name: twin.model },
        update: {},
      });
      const fitment = await prisma.vehicleFitment.upsert({
        where: { carModelId_label: { carModelId: model.id, label: twin.label } },
        create: {
          carModelId: model.id, label: twin.label,
          yearStart: twin.yearStart, yearEnd: twin.yearEnd, yearOpenEnded: twin.open ?? false,
        },
        update: {},
      });
      await prisma.productFitment.createMany({
        data: sourceProducts.map((p) => ({ productId: p.id, fitmentId: fitment.id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`\nTotal linkuri: ${totalLinks}${APPLY ? " — APLICAT" : " (dry-run; --apply ca să scrii)"}`);
}

main().finally(() => prisma.$disconnect());
