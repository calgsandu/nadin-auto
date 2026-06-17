"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

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
    await requireCatalogWrite();
    const input = await parseProductForm(formData);
    const fitment = await findOrCreateFitment(input);
    const type = await findOrCreateType(input.typeId, input.newTypeName);

    await prisma.product.create({
      data: {
        importKey: `manual:${randomUUID()}`,
        source: "MANUAL",
        manuallyEdited: true,
        sourceRow: 0,
        sourceItem: null,
        externalCode: input.externalCode,
        description: input.description,
        notes: null,
        stock: input.stock,
        priceEuro: input.priceEuro,
        costLei: input.costLei,
        salePriceLei: input.salePriceLei,
        fitmentId: fitment.id,
        typeId: type.id,
      },
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
    await requireCatalogWrite();
    const productId = readString(formData, "productId");

    if (!productId) {
      throw new Error("Lipsește produsul pentru editare.");
    }

    const input = await parseProductForm(formData);
    const fitment = await findOrCreateFitment(input);
    const type = await findOrCreateType(input.typeId, input.newTypeName);

    await prisma.product.update({
      where: { id: productId },
      data: {
        manuallyEdited: true,
        externalCode: input.externalCode,
        description: input.description,
        stock: input.stock,
        priceEuro: input.priceEuro,
        costLei: input.costLei,
        salePriceLei: input.salePriceLei,
        fitmentId: fitment.id,
        typeId: type.id,
      },
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
    await requireCatalogWrite();
    const productId = readString(formData, "productId");
    if (!productId) throw new Error("Lipsește produsul pentru ștergere.");

    const lines = await prisma.stockDocumentLine.count({ where: { productId } });
    if (lines > 0) {
      throw new Error(`Produsul are ${lines} linii în documente de stoc și nu poate fi șters.`);
    }

    // WarehouseStock rows cascade-delete with the product.
    await prisma.product.delete({ where: { id: productId } });
    revalidatePath("/");
    return { ok: true, message: "Produsul a fost șters." };
  } catch (error) {
    return toActionError(error);
  }
}

async function requireCatalogWrite() {
  const appUser = await requireCurrentAppUser();

  if (!canWriteCatalog(appUser.role)) {
    throw new Error("Nu ai drepturi pentru modificarea catalogului.");
  }
}

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
  const stock = readOptionalInteger(formData, "stock");
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
    stock,
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
