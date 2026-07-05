"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import type { StockDocumentType } from "@/generated/prisma/enums";

export type RestoreActionState = { ok: boolean; message: string };

type DeletedSnapshot = {
  type: string;
  number: number;
  documentDate: string;
  notes: string | null;
  totalLei: number | null;
  totalEuro: number | null;
  warehouse: string | null;
  partner: string | null;
  lines: { productId: string; product: string | null; quantity: number; price: number }[];
};

const DOC_TYPES = new Set(["RECEIPT", "SALE", "RETURN", "ADJUSTMENT"]);

/**
 * Restaurează un document șters, din snapshot-ul păstrat în jurnalul de audit.
 * Recreează documentul + liniile și re-aplică efectul asupra stocului.
 */
export async function restoreDocumentAction(
  _state: RestoreActionState,
  formData: FormData,
): Promise<RestoreActionState> {
  try {
    const user = await requireCurrentAppUser();
    if (!canWriteCatalog(user.role)) {
      throw new Error("Nu ai drepturi pentru restaurare.");
    }

    const auditId = String(formData.get("auditId") ?? "").trim();
    if (!auditId) throw new Error("Intrare de jurnal lipsă.");

    let restoredNumber = 0;
    await prisma.$transaction(async (tx) => {
      const entry = await tx.auditLog.findUnique({ where: { id: auditId } });
      if (!entry || entry.action !== "DELETE" || entry.entity !== "StockDocument") {
        throw new Error("Intrarea de jurnal nu este o ștergere de document.");
      }
      const details = entry.details as { deleted?: DeletedSnapshot; restoredDocumentId?: string } | null;
      const snapshot = details?.deleted;
      if (!snapshot || !DOC_TYPES.has(snapshot.type)) {
        throw new Error("Intrarea de jurnal nu conține un snapshot restaurabil.");
      }
      if (details?.restoredDocumentId) {
        throw new Error("Documentul a fost deja restaurat din această intrare.");
      }
      // Jumătățile de transfer nu se restaurează individual — ar dezechilibra stocul.
      if (
        snapshot.notes?.endsWith("Ieșire către locația destinație.") ||
        snapshot.notes?.endsWith("Intrare din locația sursă.")
      ) {
        throw new Error(
          "Jumătățile de transfer nu se pot restaura. Creează transferul din nou.",
        );
      }

      const type = snapshot.type as StockDocumentType;
      const warehouse = snapshot.warehouse
        ? await tx.warehouse.findUnique({ where: { name: snapshot.warehouse } })
        : null;
      if (!warehouse) {
        throw new Error(`Depozitul „${snapshot.warehouse ?? "?"}" nu mai există.`);
      }

      // Toate produsele trebuie să mai existe.
      const productIds = snapshot.lines.map((line) => line.productId);
      const existing = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((p) => p.id));
      const missing = snapshot.lines.filter((line) => !existingIds.has(line.productId));
      if (missing.length > 0) {
        throw new Error(
          `Nu se poate restaura: produse șterse între timp (${missing
            .map((line) => line.product ?? line.productId)
            .join(", ")}).`,
        );
      }

      const partnerId = snapshot.partner
        ? (
            await tx.partner.upsert({
              where: { name: snapshot.partner },
              create: { name: snapshot.partner },
              update: {},
            })
          ).id
        : null;

      // Numărul original dacă e liber, altfel următorul liber.
      const numberTaken = await tx.stockDocument.findUnique({
        where: { type_number: { type, number: snapshot.number } },
        select: { id: true },
      });
      let number = snapshot.number;
      if (numberTaken) {
        const last = await tx.stockDocument.findFirst({
          where: { type },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        number = (last?.number ?? 0) + 1;
      }

      const usesSalePrice = type === "SALE" || type === "RETURN";
      const document = await tx.stockDocument.create({
        data: {
          type,
          number,
          documentDate: new Date(`${snapshot.documentDate}T12:00:00`),
          warehouseId: warehouse.id,
          partnerId,
          notes: snapshot.notes
            ? `${snapshot.notes} (restaurat din jurnal)`
            : "(restaurat din jurnal)",
          totalLei: snapshot.totalLei,
          totalEuro: snapshot.totalEuro,
          lines: {
            create: snapshot.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              [usesSalePrice ? "unitPriceEuro" : "unitCostLei"]: line.price || null,
            })),
          },
        },
      });

      // Re-aplică efectul de stoc (SALE scade, restul adună cantitatea semnată).
      for (const line of snapshot.lines) {
        const effect = type === "SALE" ? -line.quantity : line.quantity;
        const stock = await tx.warehouseStock.upsert({
          where: {
            productId_warehouseId: { productId: line.productId, warehouseId: warehouse.id },
          },
          create: { productId: line.productId, warehouseId: warehouse.id, quantity: 0 },
          update: {},
        });
        const next = stock.quantity + effect;
        if (next < 0) {
          throw new Error(
            `Stoc insuficient pentru a restaura vânzarea (produsul ${line.product ?? line.productId}).`,
          );
        }
        await tx.warehouseStock.update({ where: { id: stock.id }, data: { quantity: next } });
        const stocks = await tx.warehouseStock.findMany({
          where: { productId: line.productId },
          select: { quantity: true },
        });
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: stocks.reduce((sum, s) => sum + s.quantity, 0) },
        });
      }

      // Marchează intrarea ca restaurată (anti dublă-restaurare).
      await tx.auditLog.update({
        where: { id: entry.id },
        data: { details: { ...details, restoredDocumentId: document.id } },
      });

      await logAudit(tx, user, {
        action: "CREATE",
        entity: "StockDocument",
        entityId: document.id,
        summary: `Document restaurat din jurnal: #${number} (original #${snapshot.number}, ${snapshot.lines.length} produse)`,
        details: { restoredFromAuditId: entry.id },
      });

      restoredNumber = number;
    });

    revalidatePath("/");
    return { ok: true, message: `Document restaurat cu numărul #${restoredNumber}.` };
  } catch (error) {
    if (error instanceof Error && error.message) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Restaurarea a eșuat." };
  }
}
