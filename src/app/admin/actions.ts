"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  parseFitment,
  parseModel,
  parseName,
  parseWarehouse,
} from "@/lib/admin/validate";

export type AdminActionState = { ok: boolean; message: string };

const FALLBACK: AdminActionState = { ok: false, message: "Operațiunea a eșuat." };

async function requireWrite() {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    throw new Error("Nu ai drepturi pentru această operațiune.");
  }
}

function fail(error: unknown): AdminActionState {
  if (error instanceof Error) return { ok: false, message: error.message };
  return FALLBACK;
}

function id(formData: FormData) {
  const value = formData.get("id");
  return typeof value === "string" ? value.trim() : "";
}

function done(message: string): AdminActionState {
  revalidatePath("/");
  return { ok: true, message };
}

/* ---------------------------------- Brand --------------------------------- */

export async function createBrandAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const parsed = parseName(fd);
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.brand.findUnique({ where: { name: parsed.data.name } }))
      throw new Error("Există deja un brand cu acest nume.");
    await prisma.brand.create({ data: parsed.data });
    return done("Brand adăugat.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateBrandAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const brandId = id(fd);
    const parsed = parseName(fd);
    if (!brandId) throw new Error("Brand lipsă.");
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.brand.findFirst({ where: { name: parsed.data.name, NOT: { id: brandId } } }))
      throw new Error("Există deja un brand cu acest nume.");
    await prisma.brand.update({ where: { id: brandId }, data: parsed.data });
    return done("Brand actualizat.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBrandAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const brandId = id(fd);
    if (!brandId) throw new Error("Brand lipsă.");
    const models = await prisma.carModel.count({ where: { brandId } });
    if (models > 0) throw new Error(`Brandul are ${models} modele și nu poate fi șters.`);
    await prisma.brand.delete({ where: { id: brandId } });
    return done("Brand șters.");
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------- ProductType ------------------------------ */

export async function createTypeAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const parsed = parseName(fd);
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.productType.findUnique({ where: { name: parsed.data.name } }))
      throw new Error("Există deja un tip cu acest nume.");
    await prisma.productType.create({ data: parsed.data });
    return done("Tip de produs adăugat.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateTypeAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const typeId = id(fd);
    const parsed = parseName(fd);
    if (!typeId) throw new Error("Tip lipsă.");
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.productType.findFirst({ where: { name: parsed.data.name, NOT: { id: typeId } } }))
      throw new Error("Există deja un tip cu acest nume.");
    await prisma.productType.update({ where: { id: typeId }, data: parsed.data });
    return done("Tip de produs actualizat.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTypeAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const typeId = id(fd);
    if (!typeId) throw new Error("Tip lipsă.");
    const products = await prisma.product.count({ where: { typeId } });
    if (products > 0) throw new Error(`Tipul are ${products} produse și nu poate fi șters.`);
    await prisma.productType.delete({ where: { id: typeId } });
    return done("Tip de produs șters.");
  } catch (e) {
    return fail(e);
  }
}

/* --------------------------------- CarModel ------------------------------- */

export async function createModelAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const parsed = parseModel(fd);
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.carModel.findFirst({ where: { brandId: parsed.data.brandId, name: parsed.data.name } }))
      throw new Error("Acest model există deja pentru brandul ales.");
    await prisma.carModel.create({ data: parsed.data });
    return done("Model adăugat.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateModelAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const modelId = id(fd);
    const parsed = parseModel(fd);
    if (!modelId) throw new Error("Model lipsă.");
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.carModel.findFirst({ where: { brandId: parsed.data.brandId, name: parsed.data.name, NOT: { id: modelId } } }))
      throw new Error("Acest model există deja pentru brandul ales.");
    await prisma.carModel.update({ where: { id: modelId }, data: parsed.data });
    return done("Model actualizat.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteModelAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const modelId = id(fd);
    if (!modelId) throw new Error("Model lipsă.");
    const fitments = await prisma.vehicleFitment.count({ where: { carModelId: modelId } });
    if (fitments > 0) throw new Error(`Modelul are ${fitments} compatibilități și nu poate fi șters.`);
    await prisma.carModel.delete({ where: { id: modelId } });
    return done("Model șters.");
  } catch (e) {
    return fail(e);
  }
}

/* ------------------------------ VehicleFitment ---------------------------- */

export async function createFitmentAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const parsed = parseFitment(fd);
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.vehicleFitment.findFirst({ where: { carModelId: parsed.data.carModelId, label: parsed.data.label } }))
      throw new Error("Această compatibilitate există deja pentru model.");
    await prisma.vehicleFitment.create({ data: parsed.data });
    return done("Compatibilitate adăugată.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateFitmentAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const fitmentId = id(fd);
    const parsed = parseFitment(fd);
    if (!fitmentId) throw new Error("Compatibilitate lipsă.");
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.vehicleFitment.findFirst({ where: { carModelId: parsed.data.carModelId, label: parsed.data.label, NOT: { id: fitmentId } } }))
      throw new Error("Această compatibilitate există deja pentru model.");
    await prisma.vehicleFitment.update({ where: { id: fitmentId }, data: parsed.data });
    return done("Compatibilitate actualizată.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFitmentAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const fitmentId = id(fd);
    if (!fitmentId) throw new Error("Compatibilitate lipsă.");
    const products = await prisma.product.count({ where: { fitmentId } });
    if (products > 0) throw new Error(`Compatibilitatea are ${products} produse și nu poate fi ștearsă.`);
    await prisma.vehicleFitment.delete({ where: { id: fitmentId } });
    return done("Compatibilitate ștearsă.");
  } catch (e) {
    return fail(e);
  }
}

/* -------------------------------- Warehouse ------------------------------- */

export async function createWarehouseAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const parsed = parseWarehouse(fd);
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.warehouse.findUnique({ where: { name: parsed.data.name } }))
      throw new Error("Există deja un depozit cu acest nume.");
    await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) await tx.warehouse.updateMany({ data: { isDefault: false } });
      await tx.warehouse.create({ data: parsed.data });
    });
    return done("Depozit adăugat.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateWarehouseAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const warehouseId = id(fd);
    const parsed = parseWarehouse(fd);
    if (!warehouseId) throw new Error("Depozit lipsă.");
    if (!parsed.ok) throw new Error(parsed.message);
    if (await prisma.warehouse.findFirst({ where: { name: parsed.data.name, NOT: { id: warehouseId } } }))
      throw new Error("Există deja un depozit cu acest nume.");
    await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) await tx.warehouse.updateMany({ where: { NOT: { id: warehouseId } }, data: { isDefault: false } });
      await tx.warehouse.update({ where: { id: warehouseId }, data: parsed.data });
    });
    return done("Depozit actualizat.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteWarehouseAction(_s: AdminActionState, fd: FormData): Promise<AdminActionState> {
  try {
    await requireWrite();
    const warehouseId = id(fd);
    if (!warehouseId) throw new Error("Depozit lipsă.");
    // Rows with quantity 0 are just seeded placeholders — they don't block deletion.
    const [stocks, documents] = await Promise.all([
      prisma.warehouseStock.count({ where: { warehouseId, quantity: { not: 0 } } }),
      prisma.stockDocument.count({ where: { warehouseId } }),
    ]);
    if (stocks > 0 || documents > 0)
      throw new Error("Depozitul are stoc sau documente legate și nu poate fi șters.");
    await prisma.$transaction([
      prisma.warehouseStock.deleteMany({ where: { warehouseId } }),
      prisma.warehouse.delete({ where: { id: warehouseId } }),
    ]);
    return done("Depozit șters.");
  } catch (e) {
    return fail(e);
  }
}
