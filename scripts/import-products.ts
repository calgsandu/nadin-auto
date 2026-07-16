import "dotenv/config";
import * as XLSX from "xlsx";
import type { Brand, CarModel, ProductType, VehicleFitment } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  normalizeCode,
  normalizeText,
  parseHeaderVehicles,
  parseProductDescription,
  parseVehicleApplications,
} from "@/lib/catalog/parse-product";
import { groupImportRowsByKey } from "@/lib/catalog/import-compatibilities";

type SheetRow = unknown[];

const workbookPath = process.argv.slice(2).find((argument) => argument !== "--");

if (!workbookPath) {
  throw new Error("Usage: pnpm import:products -- /absolute/path/to/file.xlsx");
}

const workbook = XLSX.readFile(workbookPath, { cellDates: false });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

if (!sheet) {
  throw new Error(`Workbook has no readable sheet: ${workbookPath}`);
}

const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
  header: 1,
  raw: true,
  blankrows: true,
});

let currentHeaderVehicles: ReturnType<typeof parseHeaderVehicles> = [];
let skipped = 0;
const parsedRows: Array<{
  importKey: string;
  sourceRow: number;
  sourceItem: string | null;
  externalCode: string | null;
  brandName: string;
  modelName: string;
  fitmentLabel: string;
  yearStart: number | null;
  yearEnd: number | null;
  yearOpenEnded: boolean;
  typeName: string;
  description: string;
  notes: string | null;
  stock: number | null;
  priceEuro: number | null;
  costLei: number | null;
}> = [];

async function main() {
  for (let index = 1; index < rows.length; index += 1) {
    const sourceRow = index + 1;
    const row = rows[index] ?? [];
    const [sourceItemValue, codeValue, modelValue, descriptionValue] = row;
    const firstCell = normalizeText(sourceItemValue);

    if (firstCell.toUpperCase().includes("CARENAJE RUSSIA")) {
      break;
    }

    if (firstCell && !codeValue && !modelValue && !descriptionValue) {
      const headerVehicles = parseHeaderVehicles(firstCell);
      currentHeaderVehicles =
        headerVehicles.length > 0 ? headerVehicles : currentHeaderVehicles;
      continue;
    }

    if (!modelValue || !descriptionValue) {
      skipped += 1;
      continue;
    }

    const vehicles = parseVehicleApplications(modelValue, currentHeaderVehicles);
    const productDescription = parseProductDescription(descriptionValue);
    const sourceItem = normalizeCode(sourceItemValue);
    const externalCode = normalizeCode(codeValue);
    const stock = normalizeNumber(row[53]);
    const priceEuro = normalizeNumber(row[54]);
    const costLei = normalizeNumber(row[55]);

    vehicles.forEach((vehicle) => {
      if (vehicle.brandName === "NECUNOSCUT") {
        skipped += 1;
        return;
      }

      parsedRows.push({
        importKey: `${sourceRow}:0`,
        sourceRow,
        sourceItem,
        externalCode,
        brandName: vehicle.brandName,
        modelName: vehicle.modelName,
        fitmentLabel: vehicle.fitmentLabel,
        yearStart: vehicle.yearStart,
        yearEnd: vehicle.yearEnd,
        yearOpenEnded: vehicle.yearOpenEnded,
        typeName: productDescription.typeName,
        description: productDescription.description,
        notes: productDescription.notes,
        stock,
        priceEuro,
        costLei,
      });
    });
  }

  const brandNames = unique(parsedRows.map((row) => row.brandName));
  const typeNames = unique(parsedRows.map((row) => row.typeName));

  await prisma.brand.createMany({
    data: brandNames.map((name) => ({ name })),
    skipDuplicates: true,
  });
  await prisma.productType.createMany({
    data: typeNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const brands = keyByName(await prisma.brand.findMany({ where: { name: { in: brandNames } } }));
  const types = keyByName(await prisma.productType.findMany({ where: { name: { in: typeNames } } }));

  const modelInputs = uniqueBy(
    parsedRows.map((row) => ({
      brandId: requireMapValue(brands, row.brandName, "brand").id,
      name: row.modelName,
    })),
    (model) => `${model.brandId}:${model.name}`,
  );

  await prisma.carModel.createMany({ data: modelInputs, skipDuplicates: true });

  const models = keyBy(
    await prisma.carModel.findMany({
      where: {
        OR: modelInputs.map((model) => ({
          brandId: model.brandId,
          name: model.name,
        })),
      },
    }),
    (model) => `${model.brandId}:${model.name}`,
  );

  const fitmentInputs = uniqueBy(
    parsedRows.map((row) => {
      const brand = requireMapValue(brands, row.brandName, "brand");
      const model = requireMapValue(models, `${brand.id}:${row.modelName}`, "model");

      return {
        carModelId: model.id,
        label: row.fitmentLabel,
        yearStart: row.yearStart,
        yearEnd: row.yearEnd,
        yearOpenEnded: row.yearOpenEnded,
      };
    }),
    (fitment) => `${fitment.carModelId}:${fitment.label}`,
  );

  await prisma.vehicleFitment.createMany({
    data: fitmentInputs,
    skipDuplicates: true,
  });

  const fitments = keyBy(
    await prisma.vehicleFitment.findMany({
      where: {
        OR: fitmentInputs.map((fitment) => ({
          carModelId: fitment.carModelId,
          label: fitment.label,
        })),
      },
    }),
    (fitment) => `${fitment.carModelId}:${fitment.label}`,
  );

  const sourceRows = parsedRows.map((row) => row.sourceRow);
  const productRows = groupImportRowsByKey(parsedRows).map(({ rows }) => rows[0]!);

  await prisma.product.deleteMany({
    where: {
      source: "EXCEL",
      manuallyEdited: false,
      sourceRow: { in: sourceRows },
    },
  });

  await prisma.product.createMany({
    data: productRows.map((row) => {
      const brand = requireMapValue(brands, row.brandName, "brand");
      const model = requireMapValue(models, `${brand.id}:${row.modelName}`, "model");
      const fitment = requireMapValue(
        fitments,
        `${model.id}:${row.fitmentLabel}`,
        "fitment",
      );
      const type = requireMapValue(types, row.typeName, "type");

      return {
        importKey: row.importKey,
        source: "EXCEL",
        manuallyEdited: false,
        sourceRow: row.sourceRow,
        sourceItem: row.sourceItem,
        externalCode: row.externalCode,
        description: row.description,
        notes: row.notes,
        stock: row.stock,
        priceEuro: row.priceEuro,
        costLei: row.costLei,
        fitmentId: fitment.id,
        typeId: type.id,
      };
    }),
    skipDuplicates: true,
  });

  const productsByImportKey = new Map(
    (
      await prisma.product.findMany({
        where: { importKey: { in: productRows.map((row) => row.importKey) } },
      })
    ).map((product) => [product.importKey, product]),
  );

  const productFitments = uniqueBy(
    parsedRows.map((row) => {
      const brand = requireMapValue(brands, row.brandName, "brand");
      const model = requireMapValue(models, `${brand.id}:${row.modelName}`, "model");
      const fitment = requireMapValue(
        fitments,
        `${model.id}:${row.fitmentLabel}`,
        "fitment",
      );
      const product = requireMapValue(productsByImportKey, row.importKey, "product");

      return { productId: product.id, fitmentId: fitment.id };
    }),
    (entry) => `${entry.productId}:${entry.fitmentId}`,
  );

  await prisma.productFitment.createMany({ data: productFitments, skipDuplicates: true });

  await cleanupOrphanCatalogRows();

  console.log(
    JSON.stringify(
      {
        sheetName,
        imported: productRows.length,
        fitmentsLinked: productFitments.length,
        skipped,
        cutoff: "CARENAJE RUSSIA",
      },
      null,
      2,
    ),
  );
}

async function cleanupOrphanCatalogRows() {
  await prisma.vehicleFitment.deleteMany({
    where: { products: { none: {} } },
  });
  await prisma.carModel.deleteMany({
    where: { fitments: { none: {} } },
  });
  await prisma.brand.deleteMany({
    where: { models: { none: {} } },
  });
  await prisma.productType.deleteMany({
    where: { products: { none: {} } },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function unique(values: string[]) {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = getKey(value);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function keyByName<T extends Brand | ProductType>(values: T[]) {
  return keyBy(values, (value) => value.name);
}

function keyBy<T extends Brand | ProductType | CarModel | VehicleFitment>(
  values: T[],
  getKey: (value: T) => string,
) {
  const map = new Map<string, T>();

  for (const value of values) {
    map.set(getKey(value), value);
  }

  return map;
}

function requireMapValue<T>(map: Map<string, T>, key: string, label: string) {
  const value = map.get(key);

  if (!value) {
    throw new Error(`Missing ${label}: ${key}`);
  }

  return value;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  const text = normalizeText(value).replace(",", ".");

  if (!text) {
    return null;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
}
