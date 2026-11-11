"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { documentSnapshot, logAudit, logAuditRequired } from "@/lib/audit";
import {
  aggregateRestockRequests,
  reconcileSaleRestockTasks,
} from "@/lib/operations/restock";
import {
  ensureSupplierPartner,
  normalizeOptionalPartnerId,
} from "@/lib/operations/supplier-selection";
import { applyReceiptCost } from "@/lib/operations/receipt-cost";
import { DOCUMENT_TX_OPTIONS } from "@/lib/operations/transaction-limits";
import { assertDocumentPeriodOpen } from "@/lib/finance/period-lock";
import {
  mergeDocumentHeader,
  mergeDocumentLines,
  mergeLineFromDb,
  parseDocumentBase,
  type LineConflict,
  type MergeHeader,
} from "@/lib/operations/document-merge";
import {
  applyWarehouseStockDeltas,
  ensureWarehouseStockRows,
  sumDeltasByProduct,
  syncProductAggregateStocks,
} from "@/lib/operations/stock-mutations";
import {
  assertSalePaymentMethodDocumentType,
  parseOptionalSalePaymentMethod,
  salePaymentMethodLabel,
} from "@/lib/operations/sale-payment-method";

export type DocumentActionState = { ok: boolean; message: string };

const FALLBACK: DocumentActionState = { ok: false, message: "Operațiunea a eșuat." };


async function requireWrite() {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    throw new Error("Nu ai drepturi pentru această operațiune.");
  }
  return user;
}

const TYPE_LABEL: Record<string, string> = {
  RECEIPT: "Recepție",
  SALE: "Vânzare",
  RETURN: "Retur",
  ADJUSTMENT: "Ajustare/Transfer",
};

function fail(error: unknown): DocumentActionState {
  if (error instanceof Error) return { ok: false, message: error.message };
  return FALLBACK;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateSalePaymentMethodAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");
    await assertDocumentPeriodOpen(id);
    const paymentMethod = parseOptionalSalePaymentMethod(
      readString(formData, "paymentMethod"),
    );
    let changed = false;

    await prisma.$transaction(async (tx) => {
      const doc = await tx.stockDocument.findUnique({
        where: { id },
        select: { id: true, type: true, number: true, paymentMethod: true },
      });
      if (!doc) throw new Error("Document inexistent.");
      assertSalePaymentMethodDocumentType(doc.type);
      if (doc.paymentMethod === paymentMethod) return;

      await tx.stockDocument.update({
        where: { id },
        data: { paymentMethod },
      });
      await logAuditRequired(tx, user, {
        action: "UPDATE",
        entity: "StockDocument",
        entityId: id,
        summary: `Vânzare #${doc.number}: metoda de plată schimbată din „${salePaymentMethodLabel(doc.paymentMethod)}” în „${salePaymentMethodLabel(paymentMethod)}”`,
        details: {
          before: { paymentMethod: doc.paymentMethod },
          after: { paymentMethod },
        },
      });
      changed = true;
    });

    revalidatePath("/crm", "layout");
    return {
      ok: true,
      message: changed
        ? "Metoda de plată a fost actualizată."
        : "Metoda de plată este deja setată astfel.",
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Delete a stock document and reverse its stock effect:
 * RECEIPT/RETURN/ADJUSTMENT added `line.quantity` (signed), SALE subtracted it,
 * so we undo by subtracting the originally applied effect.
 */
export async function deleteDocumentAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");
    await assertDocumentPeriodOpen(id);

    let message = "Document șters și stoc reversat.";
    await prisma.$transaction(async (tx) => {
      const include = {
        lines: { include: { product: { select: { description: true, externalCode: true } } } },
        warehouse: { select: { name: true } },
        partner: { select: { name: true } },
      } as const;
      const doc = await tx.stockDocument.findUnique({ where: { id }, include });
      if (!doc) throw new Error("Document inexistent.");

      // O vânzare cu retururi legate nu se poate șterge — s-ar dubla stocul
      // (returul a pus deja o parte din marfă înapoi).
      if (doc.type === "SALE") {
        const returnsCount = await tx.stockDocument.count({
          where: { type: "RETURN", sourceDocumentId: id },
        });
        if (returnsCount > 0) {
          throw new Error(
            `Vânzarea are ${returnsCount} retur(uri) legate. Șterge întâi retururile.`,
          );
        }
      }

      // Un transfer are două jumătăți (ieșire + intrare) — se șterg împreună,
      // altfel stocul rămâne dezechilibrat.
      const docsToDelete = doc.transferGroupId
        ? await tx.stockDocument.findMany({
            where: { transferGroupId: doc.transferGroupId },
            include,
          })
        : [doc];

      for (const target of docsToDelete) {
        await logAuditRequired(tx, user, {
          action: "DELETE",
          entity: "StockDocument",
          entityId: target.id,
          summary: `${TYPE_LABEL[target.type] ?? target.type} #${target.number} ștearsă (${target.lines.length} produse) — stoc reversat`,
          details: { deleted: documentSnapshot(target) },
        });

        // Reversarea pe loturi: rând cu rând, documentele lungi treceau de
        // limita tranzacției. Liniile externe nu au atins stocul — nimic de dat
        // înapoi. Stocul poate coborî sub zero (marfa a plecat între timp),
        // exact ca înainte.
        const reversals = sumDeltasByProduct(
          target.lines.flatMap((line) =>
            line.productId
              ? [
                  {
                    productId: line.productId,
                    quantity: target.type === "SALE" ? line.quantity : -line.quantity,
                  },
                ]
              : [],
          ),
        );
        if (reversals.length > 0) {
          await ensureWarehouseStockRows(
            tx,
            reversals.map((delta) => delta.productId),
            target.warehouseId,
          );
          await applyWarehouseStockDeltas(tx, target.warehouseId, reversals, {
            allowNegative: true,
          });
          await syncProductAggregateStocks(
            tx,
            reversals.map((delta) => delta.productId),
          );
        }

        await tx.restockTask.deleteMany({ where: { sourceDocumentId: target.id } });
        await tx.stockDocument.delete({ where: { id: target.id } });
      }

      // Retur șters = recalculează exact ce a rămas de adus pentru vânzare.
      if (doc.type === "RETURN" && doc.sourceDocumentId) {
        await reconcileSaleRestockTasks(tx, doc.sourceDocumentId);
      }

      if (docsToDelete.length > 1) {
        message = "Transfer șters (ambele jumătăți) și stoc reversat.";
      }
    // Reversarea merge linie cu linie: documentele lungi depășesc cele 5 s implicite.
    }, DOCUMENT_TX_OPTIONS);

    revalidatePath("/crm", "layout");
    return { ok: true, message };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Edit a document's lines (quantity + unit price) and header, reconciling stock.
 * Strategy: reverse the old lines' stock effect, replace the lines, re-apply.
 * Product per line stays fixed (productId is carried in a hidden field).
 */
export async function updateDocumentLinesAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireWrite();
    const id = readString(formData, "id");
    if (!id) throw new Error("Document lipsă.");
    await assertDocumentPeriodOpen(id);

    const productIds = formData.getAll("lineProductId").map((v) => String(v).trim());
    const quantities = formData.getAll("lineQuantity").map((v) => String(v));
    const prices = formData.getAll("linePrice").map((v) => String(v));
    const externalNames = formData.getAll("lineExternalName").map((v) => String(v).trim());
    const externalCodes = formData.getAll("lineExternalCode").map((v) => String(v).trim());
    const externalSupplierIds = formData.getAll("lineExternalSupplierId").map((v) => String(v).trim());
    const externalCosts = formData.getAll("lineExternalCostLei").map((v) => String(v));

    const dateRaw = readString(formData, "documentDate");
    const notes = readString(formData, "notes") || null;
    const partnerName = readString(formData, "partnerName");
    const requestedWarehouseId = readString(formData, "warehouseId");
    const selectedPartnerId = normalizeOptionalPartnerId(readString(formData, "partnerId"));
    const documentDate = dateRaw ? new Date(`${dateRaw}T12:00:00`) : undefined;
    if (documentDate && Number.isNaN(documentDate.getTime())) {
      throw new Error("Data documentului nu este validă.");
    }
    // A doua verificare: data nouă nu poate muta documentul într-o lună închisă.
    await assertDocumentPeriodOpen(id, documentDate);
    // Versiunea documentului de la care a pornit editarea. Fără ea nu se poate
    // ști ce a schimbat operatorul și ce a salvat altcineva între timp.
    const baseRaw = readString(formData, "documentBase");
    if (!baseRaw) {
      throw new Error("Pagina este veche. Reîncarcă pagina și editează din nou.");
    }

    const seenProducts = new Set<string>();
    const formLines = productIds.flatMap((productId, i) => {
      const quantity = Number(quantities[i]);
      const raw = (prices[i] ?? "").trim().replace(",", ".");
      const price = raw ? Number(raw) : null;
      const externalName = externalNames[i] ?? "";
      const rawCost = (externalCosts[i] ?? "").trim().replace(",", ".");
      const externalCost = rawCost ? Number(rawCost) : null;
      // Rând adăugat dar lăsat gol: se scoate singur, nu blochează salvarea.
      if (!productId && !externalName) return [];
      if (productId && seenProducts.has(productId)) {
        throw new Error(`Produsul de pe poziția ${i + 1} este adăugat de mai multe ori.`);
      }
      // Ajustările (inventar) au diferențe cu semn; restul documentelor doar
      // cantități pozitive — semnul se validează după ce știm tipul (în tranzacție).
      if (!Number.isInteger(quantity) || quantity === 0) {
        throw new Error(`Cantitate invalidă pe poziția ${i + 1}.`);
      }
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        throw new Error(`Preț invalid pe poziția ${i + 1}.`);
      }
      if (externalCost !== null && (!Number.isFinite(externalCost) || externalCost < 0)) {
        throw new Error(`Cost invalid pe poziția ${i + 1}.`);
      }
      if (productId) seenProducts.add(productId);
      return [{
        productId: productId || null,
        externalName: productId ? null : externalName || null,
        externalCode: productId ? null : externalCodes[i] || null,
        externalSupplierId: productId ? null : externalSupplierIds[i] || null,
        externalCost: productId ? null : externalCost,
        quantity,
        price,
      }];
    });
    if (formLines.length === 0) throw new Error("Documentul trebuie să aibă cel puțin un produs.");

    let conflicts: LineConflict[] = [];
    let mergedWithOthers = false;

    await prisma.$transaction(async (tx) => {
      // Două salvări simultane ale aceluiași document se așteaptă una pe alta;
      // a doua citește liniile scrise de prima și se îmbină peste ele.
      await tx.$queryRaw`SELECT id FROM "StockDocument" WHERE id = ${id} FOR UPDATE`;
      const doc = await tx.stockDocument.findUnique({
        where: { id },
        include: {
          lines: { include: { product: { select: { description: true, externalCode: true } } } },
          warehouse: { select: { name: true } },
          partner: { select: { name: true } },
        },
      });
      if (!doc) throw new Error("Document inexistent.");

      const base = parseDocumentBase(baseRaw, doc.type !== "ADJUSTMENT");
      if (!base) throw new Error("Pagina este veche. Reîncarcă pagina și editează din nou.");

      // Se aplică doar ce a schimbat operatorul față de versiunea lui; ce a
      // salvat altcineva între timp rămâne (înainte: tabul vechi ștergea tot).
      const labels = new Map(
        doc.lines.map((line) => [
          line.productId ?? "",
          line.product
            ? [line.product.externalCode, line.product.description].filter(Boolean).join(" ")
            : line.externalName ?? "",
        ]),
      );
      const mergedLines = mergeDocumentLines(
        base.lines,
        formLines.map((line) => ({
          ...line,
          // Inventarul nu are preț pe formular; returul îl ia oricum din vânzare.
          price: doc.type === "ADJUSTMENT" ? null : line.price,
        })),
        doc.lines.map((line) => mergeLineFromDb(line, doc.type)),
        (line) => (line.productId ? labels.get(line.productId) || line.productId : line.externalName ?? "piesă externă"),
      );
      const theirsHeader: MergeHeader = {
        documentDate: doc.documentDate.toISOString().slice(0, 10),
        notes: doc.notes?.trim() ?? "",
        warehouseId: doc.warehouseId,
        partnerId: doc.partnerId ?? "",
        partnerName: doc.partner?.name ?? "",
      };
      const mergedHeader = mergeDocumentHeader(
        base.header,
        {
          // Câmp lipsă din formular = neatins.
          documentDate: dateRaw || base.header.documentDate,
          notes: notes ?? "",
          warehouseId: requestedWarehouseId || base.header.warehouseId,
          partnerId: doc.type === "RECEIPT" ? (selectedPartnerId ?? "") : base.header.partnerId,
          partnerName: doc.type !== "RECEIPT" && partnerName ? partnerName : base.header.partnerName,
        },
        theirsHeader,
      );
      conflicts = mergedLines.conflicts;
      mergedWithOthers = mergedLines.theirsChanged || mergedHeader.theirsChanged;
      const lines = mergedLines.lines;
      if (lines.length === 0) throw new Error("Documentul trebuie să aibă cel puțin un produs.");
      const header = mergedHeader.header;
      const documentDate =
        header.documentDate && header.documentDate !== theirsHeader.documentDate
          ? new Date(`${header.documentDate}T12:00:00`)
          : undefined;
      if (documentDate && Number.isNaN(documentDate.getTime())) {
        throw new Error("Data documentului nu este validă.");
      }

      // Jumătățile de transfer nu se editează pe linii — ar desincroniza
      // cealaltă jumătate. Se șterge transferul și se creează din nou.
      if (doc.transferGroupId) {
        throw new Error(
          "Transferurile nu se pot edita pe produse. Șterge transferul (se șterg ambele jumătăți) și creează-l din nou.",
        );
      }

      const beforeSnapshot = documentSnapshot(doc);
      const isSale = doc.type === "SALE";

      // Mutarea documentului în alt depozit: stocul se reversează în depozitul
      // vechi și se aplică în cel nou. Vânzările și retururile rămân pe loc —
      // acolo atârnă coada „De adus 110A" și legătura cu vânzarea sursă.
      let targetWarehouseId = doc.warehouseId;
      let movedTo: string | null = null;
      if (header.warehouseId && header.warehouseId !== doc.warehouseId) {
        if (doc.type !== "RECEIPT" && doc.type !== "ADJUSTMENT") {
          throw new Error(
            "Doar recepțiile și inventarele pot fi mutate în alt depozit. Șterge documentul și creează-l din nou.",
          );
        }
        const target = await tx.warehouse.findFirst({
          where: { id: header.warehouseId, active: true },
          select: { id: true, name: true },
        });
        if (!target) throw new Error("Depozitul ales nu există sau este dezactivat.");
        targetWarehouseId = target.id;
        movedTo = target.name;
      }

      // Doar ajustările pot avea linii negative (minus la inventar).
      if (doc.type !== "ADJUSTMENT" && lines.some((line) => line.quantity < 0)) {
        throw new Error("Cantitățile nu pot fi negative pe acest tip de document.");
      }

      const returnPriceByProduct = new Map<string, number | null>();

      if (doc.type === "RETURN") {
        if (!doc.sourceDocumentId) {
          throw new Error(
            "Returul nu mai are legătura cu vânzarea sursă și nu poate fi editat.",
          );
        }
        const lockedSale = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "StockDocument"
          WHERE id = ${doc.sourceDocumentId} AND type = 'SALE'
          FOR UPDATE`;
        if (lockedSale.length === 0) {
          throw new Error("Vânzarea sursă a returului nu mai există.");
        }
        const sourceSale = await tx.stockDocument.findUnique({
          where: { id: doc.sourceDocumentId },
          include: { lines: true },
        });
        if (!sourceSale || sourceSale.type !== "SALE") {
          throw new Error("Vânzarea sursă a returului nu mai există.");
        }
        if (sourceSale.warehouseId !== doc.warehouseId) {
          throw new Error("Returul și vânzarea sursă au locații diferite.");
        }
        if (documentDate && documentDate < sourceSale.documentDate) {
          throw new Error(
            "Data returului nu poate fi înaintea datei vânzării.",
          );
        }

        const otherReturnLines = await tx.stockDocumentLine.findMany({
          where: {
            document: {
              type: "RETURN",
              sourceDocumentId: doc.sourceDocumentId,
              NOT: { id },
            },
          },
          select: { productId: true, quantity: true },
        });
        const returnedElsewhere = new Map<string, number>();
        for (const line of otherReturnLines) {
          if (!line.productId) continue;
          returnedElsewhere.set(
            line.productId,
            (returnedElsewhere.get(line.productId) ?? 0) + line.quantity,
          );
        }
        const soldByProduct = new Map(
          sourceSale.lines.map((line) => [line.productId, line]),
        );
        for (const line of lines) {
          const sold = line.productId ? soldByProduct.get(line.productId) : null;
          if (!sold || !line.productId) {
            throw new Error(
              "Un produs din retur nu face parte din vânzarea sursă.",
            );
          }
          const available =
            sold.quantity - (returnedElsewhere.get(line.productId) ?? 0);
          if (line.quantity > available) {
            throw new Error(
              `Cantitatea returnată depășește ce a rămas de returnat (${Math.max(available, 0)} din ${sold.quantity} vândute).`,
            );
          }
          returnPriceByProduct.set(
            line.productId,
            sold.unitPriceEuro == null ? null : Number(sold.unitPriceEuro),
          );
        }
      }

      // O vânzare nu poate scădea sub cantitățile deja returnate.
      if (isSale) {
        const returnLines = await tx.stockDocumentLine.findMany({
          where: { document: { type: "RETURN", sourceDocumentId: id } },
          select: { productId: true, quantity: true },
        });
        const returnedByProduct = new Map<string, number>();
        for (const line of returnLines) {
          if (!line.productId) continue;
          returnedByProduct.set(
            line.productId,
            (returnedByProduct.get(line.productId) ?? 0) + line.quantity,
          );
        }
        for (const [productId, returned] of returnedByProduct) {
          const newQuantity = lines.find((l) => l.productId === productId)?.quantity ?? 0;
          if (newQuantity < returned) {
            throw new Error(
              `Un produs are deja ${returned} bucăți returnate — cantitatea vândută nu poate scădea sub atât. Șterge întâi returul.`,
            );
          }
        }
      }

      // Sales AND returns carry the per-line price in unitPriceEuro (lei).
      const priceField = isSale || doc.type === "RETURN" ? "unitPriceEuro" : "unitCostLei";
      // Ajustările (ex. inventar) au semne mixte pe linii — formularul trimite
      // diferența cu semn, așa cum e stocată. Restul documentelor sunt pozitive.
      const newLines = lines.map((line) => ({
        ...line,
        price:
          doc.type === "RETURN"
            ? (line.productId ? (returnPriceByProduct.get(line.productId) ?? null) : null)
            : line.price,
        signedQuantity: line.quantity,
      }));

      // 1. Replace lines (liniile externe n-au productId și nu ating stocul).
      await tx.stockDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.stockDocumentLine.createMany({
        data: newLines.map((nl) => ({
          documentId: id,
          productId: nl.productId,
          externalName: nl.externalName,
          externalCode: nl.externalCode,
          externalSupplierId: nl.externalSupplierId,
          quantity: nl.signedQuantity,
          [priceField]: nl.price,
          ...(nl.productId ? {} : { unitCostLei: nl.externalCost }),
        })),
      });
      const total = newLines.reduce((sum, nl) => sum + nl.quantity * (nl.price ?? 0), 0);

      // 2. Stocul, pe loturi: fiecare produs făcea până acum 3-4 drumuri
      // separate la Neon, iar documentele lungi treceau de limita tranzacției.
      // Efectul vechi se anulează, cel nou se aplică; când documentul rămâne în
      // același depozit cele două se însumează, deci un rând care coboară sub
      // zero doar între timp nu mai blochează editarea.
      const reversals = sumDeltasByProduct(
        doc.lines.flatMap((line) =>
          line.productId
            ? [{ productId: line.productId, quantity: isSale ? line.quantity : -line.quantity }]
            : [],
        ),
      );
      const applications = sumDeltasByProduct(
        newLines.flatMap((nl) =>
          nl.productId
            ? [{ productId: nl.productId, quantity: isSale ? -nl.quantity : nl.signedQuantity }]
            : [],
        ),
      );
      const touched = new Set(
        [...reversals, ...applications].map((delta) => delta.productId),
      );

      if (targetWarehouseId === doc.warehouseId) {
        const net = sumDeltasByProduct([...reversals, ...applications]);
        await ensureWarehouseStockRows(tx, [...touched], targetWarehouseId);
        await applyWarehouseStockDeltas(tx, targetWarehouseId, net);
      } else {
        // Mutare: marfa poate fi între timp plecată din depozitul vechi, iar
        // reversarea a avut dintotdeauna voie să-l ducă sub zero.
        await ensureWarehouseStockRows(tx, reversals.map((d) => d.productId), doc.warehouseId);
        await applyWarehouseStockDeltas(tx, doc.warehouseId, reversals, { allowNegative: true });
        await ensureWarehouseStockRows(tx, applications.map((d) => d.productId), targetWarehouseId);
        await applyWarehouseStockDeltas(tx, targetWarehouseId, applications);
      }

      // 3. Recepția editată recalculează media ponderată, ca la creare.
      // ponytail: rămâne linie cu linie — prețul se scrie per produs, cu reguli
      // proprii. Recepțiile de sute de linii cer întâi batching aici.
      if (doc.type === "RECEIPT") {
        for (const nl of newLines) {
          if (nl.productId) await applyReceiptCost(tx, nl.productId, nl.price, nl.quantity);
        }
      }

      // 4. Stocul agregat al produselor atinse, într-un singur UPDATE.
      await syncProductAggregateStocks(tx, [...touched]);

      // 5. Header + total (lei).
      let partnerId: string | null | undefined = undefined;
      if (doc.type === "RECEIPT") {
        const mergedPartnerId = header.partnerId || null;
        const partner = mergedPartnerId
          ? await tx.partner.findUnique({
              where: { id: mergedPartnerId },
              select: { id: true, kind: true },
            })
          : null;
        partnerId = ensureSupplierPartner(partner, mergedPartnerId);
      } else if (header.partnerName && header.partnerName !== theirsHeader.partnerName) {
        const partner = await tx.partner.upsert({ where: { name: header.partnerName }, create: { name: header.partnerName }, update: {} });
        partnerId = partner.id;
      }
      await tx.stockDocument.update({
        where: { id },
        data: {
          documentDate,
          notes: header.notes || null,
          totalLei: total,
          totalEuro: null,
          warehouseId: targetWarehouseId,
          ...(partnerId !== undefined ? { partnerId } : {}),
        },
      });

      if (doc.type === "RETURN" && doc.sourceDocumentId) {
        await reconcileSaleRestockTasks(tx, doc.sourceDocumentId);
      }

      if (isSale && doc.warehouse.name === "Pavilion 110A") {
        const existingRestockTasks = await tx.restockTask.count({
          where: { sourceDocumentId: id },
        });
        const removedPendingTasks = await tx.restockTask.deleteMany({
          where: { sourceDocumentId: id, status: "PENDING" },
        });

        if (existingRestockTasks === 0 || removedPendingTasks.count > 0) {
          const catalogLines = newLines.filter(
            (line): line is typeof line & { productId: string } => line.productId != null,
          );
          await tx.restockTask.createMany({
            data: aggregateRestockRequests(catalogLines).map((line) => ({
              productId: line.productId,
              warehouseId: doc.warehouseId,
              sourceDocumentId: id,
              quantity: line.quantity,
              requestedAt: documentDate ?? doc.documentDate,
            })),
          });
        }
      }

      const updated = await tx.stockDocument.findUnique({
        where: { id },
        include: {
          lines: { include: { product: { select: { description: true, externalCode: true } } } },
          warehouse: { select: { name: true } },
          partner: { select: { name: true } },
        },
      });
      if (updated) {
        await logAuditRequired(tx, user, {
          action: "UPDATE",
          entity: "StockDocument",
          entityId: id,
          summary: `${TYPE_LABEL[doc.type] ?? doc.type} #${doc.number} editată (linii + antet)${movedTo ? `, mutată din ${doc.warehouse.name} în ${movedTo}` : ""}`,
          details: {
            before: beforeSnapshot,
            after: documentSnapshot(updated),
            ...(mergedWithOthers
              ? { merged: { conflicts: conflicts.map((conflict) => conflict.label) } }
              : {}),
          },
        });
      }
    // Fiecare linie face un tur spre Neon la reversare și la re-aplicare:
    // un inventar cu zeci de poziții trece lejer de cele 5 s implicite.
    }, DOCUMENT_TX_OPTIONS);

    revalidatePath("/crm", "layout");
    if (!mergedWithOthers) return { ok: true, message: "Document actualizat (linii + stoc)." };
    const overwritten =
      conflicts.length > 0
        ? ` La ${conflicts.length} ${conflicts.length === 1 ? "poziție ai" : "poziții ai"} suprascris valoarea celuilalt: ${conflicts
            .slice(0, 5)
            .map((conflict) => conflict.label)
            .join(", ")}${conflicts.length > 5 ? "…" : ""}.`
        : "";
    return {
      ok: true,
      message: `Document actualizat. Între timp l-a salvat și altcineva: modificările celuilalt au rămas, s-au aplicat doar ale tale.${overwritten}`,
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Scadența unei recepții, pusă sau schimbată din secțiunea „De plătit".
 *
 * Fără ea, o factură recepționată fără dată nu mai putea primi una niciodată:
 * câmpul există doar în dialogul de creare, iar editarea antetului nu-l atinge.
 */
export async function setReceiptDueDateAction(
  _state: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  try {
    const user = await requireCurrentAppUser();
    if (!canWriteCatalog(user.role)) {
      throw new Error("Nu ai drepturi pentru modificarea documentelor.");
    }

    const documentId = readString(formData, "documentId");
    if (!documentId) throw new Error("Lipsește documentul.");
    await assertDocumentPeriodOpen(documentId);

    const raw = readString(formData, "dueDate");
    const dueDate = raw ? new Date(`${raw}T12:00:00`) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      throw new Error("Data scadenței nu este validă.");
    }

    const document = await prisma.stockDocument.findUnique({
      where: { id: documentId },
      select: { type: true, number: true, dueDate: true },
    });
    if (!document) throw new Error("Documentul nu există.");
    if (document.type !== "RECEIPT") {
      throw new Error("Scadența se pune doar pe recepții.");
    }

    await prisma.stockDocument.update({ where: { id: documentId }, data: { dueDate } });
    await logAudit(prisma, user, {
      action: "UPDATE",
      entity: "StockDocument",
      entityId: documentId,
      summary: dueDate
        ? `Scadența recepției #${document.number}: ${dueDate.toLocaleDateString("ro-MD")}`
        : `Scadența recepției #${document.number} a fost ștearsă`,
      details: {
        before: document.dueDate?.toISOString() ?? null,
        after: dueDate?.toISOString() ?? null,
      },
    });

    revalidatePath("/crm", "layout");
    return { ok: true, message: "Scadența a fost salvată." };
  } catch (error) {
    return fail(error);
  }
}
