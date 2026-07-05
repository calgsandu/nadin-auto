/**
 * Backfill unic (2026-07-05): leagă retururile de vânzările sursă
 * (sourceDocumentId, din notes „Retur pentru Vânzare #N") și jumătățile de
 * transfer între ele (transferGroupId, din perechile ADJUSTMENT consecutive
 * cu notes „...Ieșire către locația destinație." / „...Intrare din locația sursă.").
 * Idempotent: sare peste rândurile deja legate.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

async function main() {
  // 1. Retururi → vânzarea sursă.
  const returns = await prisma.stockDocument.findMany({
    where: { type: "RETURN", sourceDocumentId: null },
    select: { id: true, number: true, notes: true },
  });
  let linkedReturns = 0;
  for (const ret of returns) {
    const match = ret.notes?.match(/Retur pentru Vânzare #(\d+)/);
    if (!match) continue;
    const sale = await prisma.stockDocument.findUnique({
      where: { type_number: { type: "SALE", number: Number(match[1]) } },
      select: { id: true },
    });
    if (!sale) continue;
    await prisma.stockDocument.update({
      where: { id: ret.id },
      data: { sourceDocumentId: sale.id },
    });
    linkedReturns += 1;
  }
  console.log(`Retururi legate: ${linkedReturns}/${returns.length}`);

  // 2. Transferuri → grup comun pentru perechea ieșire/intrare.
  const adjustments = await prisma.stockDocument.findMany({
    where: { type: "ADJUSTMENT", transferGroupId: null },
    select: { id: true, number: true, notes: true, documentDate: true },
    orderBy: { number: "asc" },
  });
  let linkedPairs = 0;
  for (let i = 0; i < adjustments.length - 1; i += 1) {
    const out = adjustments[i];
    const inn = adjustments[i + 1];
    const outMatch = out.notes?.endsWith("Ieșire către locația destinație.");
    const innMatch = inn.notes?.endsWith("Intrare din locația sursă.");
    const samePrefix =
      out.notes && inn.notes &&
      out.notes.replace(/Ieșire către locația destinație\.$/, "") ===
        inn.notes.replace(/Intrare din locația sursă\.$/, "");
    if (
      outMatch && innMatch && samePrefix &&
      inn.number === out.number + 1 &&
      out.documentDate.getTime() === inn.documentDate.getTime()
    ) {
      const groupId = randomUUID();
      await prisma.stockDocument.updateMany({
        where: { id: { in: [out.id, inn.id] } },
        data: { transferGroupId: groupId },
      });
      linkedPairs += 1;
      i += 1; // perechea consumată
    }
  }
  console.log(`Perechi transfer legate: ${linkedPairs}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
