"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  calculateWarehouseStockTotal,
  parseWarehouseStockAssignments,
  type WarehouseStockAssignment,
} from "@/lib/catalog/warehouse-stock";

export type CatalogActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_ERROR: CatalogActionState = {
  ok: false,
  message: "Nu s-a putut salva produsul.",
};

export async function createProductAction(
  _state: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  try {
    const user = await requireCatalogWrite();
    const input = await parseProductForm(formData);
    const warehouseAssignments = await parseWarehouseAssignments(formData);
    const fitment = await findOrCreateFitment(input);
    const type = await findOrCreateType(input.typeId, input.newTypeName);

    await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          importKey: `manual:${randomUUID()}`,
          source: "MANUAL",
          manuallyEdited: true,
          sourceRow: 0,
          sourceItem: null,
          externalCode: input.externalCode,
          description: input.description,
          notes: null,
          stock: 0,
          minStock: input.minStock,
          priceEuro: input.priceEuro,
          costLei: input.costLei,
          salePriceLei: input.salePriceLei,
          fitmentId: fitment.id,
          typeId: type.id,
        },
      });
      await tx.productFitment.create({
        data: { productId: created.id, fitmentId: fitment.id },
      });
      const after = await saveWarehouseStocks(tx, created.id, warehouseAssignments);

      await logAudit(tx, user, {
        action: "CREATE",
        entity: "Product",
        entityId: created.id,
        summary: `Produs adăugat: ${created.externalCode ? `${created.externalCode} · ` : ""}${created.description}`,
        details: {
          after: productAuditSnapshot(after.product),
          warehouseStocks: after.rows,
        },
      });
    });

    revalidatePath("/");
    return { ok: true, message: "Produsul a fost adăugat." };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProductAction(
  _state: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  try {
    const user = await requireCatalogWrite();
    const productId = readString(formData, "productId");

    if (!productId) {
      throw new Error("Lipsește produsul pentru editare.");
    }

    const input = await parseProductForm(formData);
    const warehouseAssignments = await parseWarehouseAssignments(formData);
    const fitment = await findOrCreateFitment(input);
    const type = await findOrCreateType(input.typeId, input.newTypeName);

    await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({
        where: { id: productId },
        include: { warehouseStocks: { include: { warehouse: { select: { name: true } } } } },
      });
      if (!before) throw new Error("Produsul nu există.");

      const updated = await tx.product.update({
        where: { id: productId },
        data: {
          manuallyEdited: true,
          externalCode: input.externalCode,
          description: input.description,
          minStock: input.minStock,
          priceEuro: input.priceEuro,
          costLei: input.costLei,
          salePriceLei: input.salePriceLei,
          fitmentId: fitment.id,
          typeId: type.id,
        },
      });
      await tx.productFitment.upsert({
        where: { productId_fitmentId: { productId, fitmentId: fitment.id } },
        create: { productId, fitmentId: fitment.id },
        update: {},
      });
      const after = await saveWarehouseStocks(tx, productId, warehouseAssignments);

      await logAudit(tx, user, {
        action: "UPDATE",
        entity: "Product",
        entityId: productId,
        summary: `Produs editat: ${updated.externalCode ? `${updated.externalCode} · ` : ""}${updated.description}`,
        details: {
          before: productAuditSnapshot(before),
          beforeWarehouseStocks: before.warehouseStocks.map((row) => ({
            warehouse: row.warehouse.name,
            quantity: row.quantity,
          })),
          after: productAuditSnapshot(after.product),
          afterWarehouseStocks: after.rows,
        },
      });
    });

    revalidatePath("/");
    return { ok: true, message: "Produsul a fost salvat." };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteProductAction(
  _state: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  try {
    const user = await requireCatalogWrite();
    const productId = readString(formData, "productId");
    if (!productId) throw new Error("Lipsește produsul pentru ștergere.");

    const lines = await prisma.stockDocumentLine.count({ where: { productId } });
    if (lines > 0) {
      throw new Error(`Produsul are ${lines} linii în documente de stoc și nu poate fi șters.`);
    }

    // WarehouseStock rows cascade-delete with the product.
    const deleted = await prisma.product.delete({ where: { id: productId } });

    await logAudit(prisma, user, {
      action: "DELETE",
      entity: "Product",
      entityId: productId,
      summary: `Produs șters: ${deleted.externalCode ? `${deleted.externalCode} · ` : ""}${deleted.description}`,
      details: { deleted: productAuditSnapshot(deleted) },
    });

    revalidatePath("/");
    return { ok: true, message: "Produsul a fost șters." };
  } catch (error) {
    return toActionError(error);
  }
}

async function parseWarehouseAssignments(formData: FormData) {
  const activeWarehouses = await prisma.warehouse.findMany({
    where: { active: true },
    select: { id: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return parseWarehouseStockAssignments(
    {
      warehouseIds: readStrings(formData, "warehouseId"),
      quantities: readStrings(formData, "warehouseQuantity"),
    },
    activeWarehouses,
  );
}

async function saveWarehouseStocks(
  tx: TransactionClient,
  productId: string,
  assignments: WarehouseStockAssignment[],
) {
  for (const assignment of assignments) {
    await tx.warehouseStock.upsert({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId: assignment.warehouseId,
        },
      },
      create: {
        productId,
        warehouseId: assignment.warehouseId,
        quantity: assignment.quantity,
      },
      update: { quantity: assignment.quantity },
    });
  }

  const rows = await tx.warehouseStock.findMany({
    where: { productId },
    include: { warehouse: { select: { name: true } } },
    orderBy: { warehouse: { name: "asc" } },
  });
  const activeIds = new Set(assignments.map((assignment) => assignment.warehouseId));
  const preservedRows = rows.filter((row) => !activeIds.has(row.warehouseId));
  const total = calculateWarehouseStockTotal(assignments, preservedRows);
  const product = await tx.product.update({
    where: { id: productId },
    data: { stock: total, manuallyEdited: true },
  });

  return {
    product,
    rows: rows.map((row) => ({ warehouse: row.warehouse.name, quantity: row.quantity })),
  };
}

async function requireCatalogWrite() {
  const appUser = await requireCurrentAppUser();

  if (!canWriteCatalog(appUser.role)) {
    throw new Error("Nu ai drepturi pentru modificarea catalogului.");
  }
  return appUser;
}

function productAuditSnapshot(product: {
  externalCode: string | null;
  description: string;
  stock: number | null;
  priceEuro: { toString(): string } | number | null;
  costLei: { toString(): string } | number | null;
  salePriceLei: { toString(): string } | number | null;
}) {
  return {
    externalCode: product.externalCode,
    description: product.description,
    stock: product.stock,
    priceEuro: product.priceEuro != null ? Number(product.priceEuro) : null,
    costLei: product.costLei != null ? Number(product.costLei) : null,
    salePriceLei: product.salePriceLei != null ? Number(product.salePriceLei) : null,
  };
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function parseProductForm(formData: FormData) {
  const externalCode = readString(formData, "externalCode");
  const description = readString(formData, "description");
  const brandId = readString(formData, "brandId");
  const modelId = readString(formData, "modelId");
  const typeId = readString(formData, "typeId");
  const newBrandName = normalizeCatalogName(readString(formData, "newBrandName"));
  const newModelName = normalizeCatalogName(readString(formData, "newModelName"));
  const newTypeName = normalizeCatalogName(readString(formData, "newTypeName"));
  const yearStart = readOptionalInteger(formData, "yearStart");
  const yearEnd = formData.get("yearOpenEnded")
    ? null
    : readOptionalInteger(formData, "yearEnd");
  const yearOpenEnded = Boolean(formData.get("yearOpenEnded"));
  const minStock = readOptionalInteger(formData, "minStock");
  const priceEuro = readOptionalDecimal(formData, "priceEuro");
  const costLei = readOptionalDecimal(formData, "costLei");
  const salePriceRaw = readOptionalDecimal(formData, "salePriceLei");
  // Default sale price = double the acquisition cost, rounded to the nearest 50.
  const salePriceLei = salePriceRaw ?? computeSalePrice(costLei);

  if (!description) {
    throw new Error("Descrierea este obligatorie.");
  }

  if (!brandId && !newBrandName) {
    throw new Error("Alege un brand sau scrie unul nou.");
  }

  if (!modelId && !newModelName) {
    throw new Error("Alege un model sau scrie unul nou.");
  }

  if (!typeId && !newTypeName) {
    throw new Error("Alege un tip sau scrie unul nou.");
  }

  if (yearStart && yearEnd && yearStart > yearEnd) {
    throw new Error("Anul de început nu poate fi mai mare decât anul final.");
  }

  return {
    externalCode,
    description,
    brandId,
    modelId,
    typeId,
    newBrandName,
    newModelName,
    newTypeName,
    yearStart,
    yearEnd,
    yearOpenEnded,
    salePriceLei,
    minStock,
    priceEuro,
    costLei,
  };
}

async function findOrCreateFitment(input: Awaited<ReturnType<typeof parseProductForm>>) {
  const brand = await findOrCreateBrand(input.brandId, input.newBrandName);
  const model = await findOrCreateModel(brand.id, input.modelId, input.newModelName);
  const label = buildFitmentLabel(
    brand.name,
    model.name,
    input.yearStart,
    input.yearEnd,
    input.yearOpenEnded,
  );

  return prisma.vehicleFitment.upsert({
    where: {
      carModelId_label: {
        carModelId: model.id,
        label,
      },
    },
    create: {
      carModelId: model.id,
      label,
      yearStart: input.yearStart,
      yearEnd: input.yearEnd,
      yearOpenEnded: input.yearOpenEnded,
    },
    update: {
      yearStart: input.yearStart,
      yearEnd: input.yearEnd,
      yearOpenEnded: input.yearOpenEnded,
    },
  });
}

async function findOrCreateBrand(id: string, newName: string) {
  if (newName) {
    const existing = await prisma.brand.findFirst({
      where: { name: { equals: newName, mode: "insensitive" } },
    });

    return existing ?? prisma.brand.create({ data: { name: newName } });
  }

  const brand = await prisma.brand.findUnique({ where: { id } });

  if (!brand) {
    throw new Error("Brandul ales nu există.");
  }

  return brand;
}

async function findOrCreateModel(brandId: string, id: string, newName: string) {
  if (newName) {
    const existing = await prisma.carModel.findFirst({
      where: {
        brandId,
        name: { equals: newName, mode: "insensitive" },
      },
    });

    return existing ?? prisma.carModel.create({ data: { brandId, name: newName } });
  }

  const model = await prisma.carModel.findUnique({ where: { id } });

  if (!model || model.brandId !== brandId) {
    throw new Error("Modelul ales nu există pentru brandul selectat.");
  }

  return model;
}

async function findOrCreateType(id: string, newName: string) {
  if (newName) {
    const existing = await prisma.productType.findFirst({
      where: { name: { equals: newName, mode: "insensitive" } },
    });

    return existing ?? prisma.productType.create({ data: { name: newName } });
  }

  const type = await prisma.productType.findUnique({ where: { id } });

  if (!type) {
    throw new Error("Tipul ales nu există.");
  }

  return type;
}

function buildFitmentLabel(
  brandName: string,
  modelName: string,
  yearStart: number | null,
  yearEnd: number | null,
  yearOpenEnded: boolean,
) {
  const years = formatYearLabel(yearStart, yearEnd, yearOpenEnded);

  return [brandName, modelName, years].filter(Boolean).join(" ");
}

function formatYearLabel(
  yearStart: number | null,
  yearEnd: number | null,
  yearOpenEnded: boolean,
) {
  if (!yearStart && !yearEnd) {
    return "";
  }

  if (yearOpenEnded) {
    return `${yearStart ?? ""}+`;
  }

  return [yearStart, yearEnd].filter(Boolean).join("-");
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readStrings(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""));
}

function readOptionalInteger(formData: FormData, key: string) {
  const value = readString(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Valoarea pentru ${key} trebuie să fie număr întreg.`);
  }

  return parsed;
}

function readOptionalDecimal(formData: FormData, key: string) {
  const value = readString(formData, key).replace(",", ".");

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valoarea pentru ${key} trebuie să fie numerică.`);
  }

  return parsed;
}

/** Sale price = double the acquisition cost, rounded to the nearest 50 lei. */
function computeSalePrice(costLei: number | null): number | null {
  if (costLei == null) return null;
  return Math.round((costLei * 2) / 50) * 50;
}

function normalizeCatalogName(value: string) {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function toActionError(error: unknown): CatalogActionState {
  if (error instanceof Error && error.message) {
    return { ok: false, message: error.message };
  }

  return INITIAL_ERROR;
}
