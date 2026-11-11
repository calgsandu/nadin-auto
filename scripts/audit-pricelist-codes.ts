import "dotenv/config";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { normalizeCode, normalizeText } from "@/lib/catalog/parse-product";
import { canon, fixTypos, stripMarkers } from "@/lib/catalog/pricelist-text";

// ponytail: audit read-only pe coduri, între pricelist și DB. Nu scrie nimic.
// Usage: tsx scripts/audit-pricelist-codes.ts <file.xlsx>

const workbookPath = process.argv.slice(2).find((a) => a !== "--" && !a.startsWith("--"));
if (!workbookPath) throw new Error("Usage: tsx scripts/audit-pricelist-codes.ts <file.xlsx>");

// aceeași normalizare ca importerul, altfel auditul „găsește" drift acolo unde
// singura diferență e un marker ZZZ//local/ sau o typo de-a furnizorului
const clean = (value: string) => canon(fixTypos(stripMarkers(value).desc));

type SheetRow = { row: number; code: string | null; model: string; desc: string };

function readSheet(path: string): SheetRow[] {
  const wb = XLSX.readFile(path, { cellDates: false });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, {
    header: 1,
    raw: true,
    blankrows: true,
  });
  const out: SheetRow[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i] ?? [];
    const model = normalizeText(r[2]);
    const desc = normalizeText(r[3]);
    if (!model || !desc) continue;
    out.push({ row: i + 1, code: normalizeCode(r[1]), model, desc });
  }
  return out;
}

function section(title: string, lines: string[]) {
  console.log(`\n=== ${title}: ${lines.length} ===`);
  for (const line of lines) console.log(`  ${line}`);
}

async function main() {
  const sheet = readSheet(workbookPath!);
  const products = await prisma.product.findMany({
    select: {
      id: true,
      importKey: true,
      sourceRow: true,
      externalCode: true,
      description: true,
      manuallyEdited: true,
      stock: true,
      fitment: { select: { label: true, carModel: { select: { name: true, brand: { select: { name: true } } } } } },
    },
    orderBy: { id: "asc" },
  });

  console.log(`Pricelist: ${sheet.length} rânduri de produs. DB: ${products.length} produse.`);

  // 1. în pricelist: un cod folosit pentru produse diferite
  const sheetByCode = new Map<string, SheetRow[]>();
  for (const r of sheet) {
    if (!r.code) continue;
    const key = canon(r.code);
    if (!sheetByCode.has(key)) sheetByCode.set(key, []);
    sheetByCode.get(key)!.push(r);
  }
  const sheetClashes: string[] = [];
  for (const [, group] of sheetByCode) {
    const distinct = new Set(group.map((r) => `${canon(r.model)}|${clean(r.desc)}`));
    if (distinct.size < 2) continue;
    for (const r of group) sheetClashes.push(`${r.row} | ${r.code} | ${r.model} | ${r.desc}`);
    sheetClashes.push("  —");
  }
  section("PRICELIST: un cod pe produse diferite", sheetClashes);

  // 2. în DB: un cod pe produse diferite
  const dbByCode = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.externalCode) continue;
    const key = canon(p.externalCode);
    if (!dbByCode.has(key)) dbByCode.set(key, []);
    dbByCode.get(key)!.push(p);
  }
  const dbClashes: string[] = [];
  for (const [, group] of dbByCode) {
    const distinct = new Set(group.map((p) => `${canon(p.fitment.carModel.name)}|${clean(p.description)}`));
    if (distinct.size < 2) continue;
    for (const p of group)
      dbClashes.push(`${p.sourceRow} | ${p.externalCode} | ${p.fitment.label} | ${p.description}`);
    dbClashes.push("  —");
  }
  section("DB: un cod pe produse diferite", dbClashes);

  // 3. drift pe rând-sursă: produsele poartă rândul din foaia din care au fost importate.
  // Potrivirea cere ȘI descrierea, deci un produs venit din altă versiune de pricelist
  // care nimerește același rând nu produce fals pozitiv.
  const dbByRow = new Map<number, typeof products>();
  for (const p of products) {
    // universalele au descriere compusă (descriere + linia de produs), nu copiată din
    // foaie — le verificăm doar pe cod, altfel ies ca „descriere schimbată"
    if (p.fitment.carModel.brand.name === "UNIVERSAL") continue;
    if (!dbByRow.has(p.sourceRow)) dbByRow.set(p.sourceRow, []);
    dbByRow.get(p.sourceRow)!.push(p);
  }
  let aligned = 0;
  const codeDrift: string[] = [];
  const descDrift: string[] = [];
  const noRow: string[] = [];
  const universalRows = new Set(
    products
      .filter((p) => p.fitment.carModel.brand.name === "UNIVERSAL")
      .map((p) => p.sourceRow),
  );
  for (const r of sheet) {
    if (universalRows.has(r.row)) continue;
    const atRow = dbByRow.get(r.row);
    if (!atRow?.length) {
      noRow.push(`${r.row} | ${r.code ?? "∅"} | ${r.model} | ${r.desc}`);
      continue;
    }
    const sameDesc = atRow.filter((p) => clean(p.description) === clean(r.desc));
    if (sameDesc.length) {
      aligned += 1;
      for (const p of sameDesc) {
        const dbCode = p.externalCode;
        if (canon(dbCode ?? "") !== canon(r.code ?? "")) {
          codeDrift.push(
            `${r.row} | DB ${dbCode ?? "∅"} → pricelist ${r.code ?? "∅"} | ${r.desc}${p.manuallyEdited ? " [editat manual]" : ""}`,
          );
        }
      }
      continue;
    }
    // rândul există în DB, dar cu altă descriere
    const sameCode =
      r.code && atRow.find((p) => canon(p.externalCode ?? "") === canon(r.code!));
    if (sameCode) {
      descDrift.push(
        `${r.row} | ${r.code} | DB „${sameCode.description}" → pricelist „${r.desc}"`,
      );
    } else {
      noRow.push(`${r.row} | ${r.code ?? "∅"} | ${r.model} | ${r.desc} (rândul are alt produs în DB)`);
    }
  }
  console.log(
    `\nAliniere rând-sursă: ${aligned}/${sheet.length} rânduri se potrivesc cu produsul din DB de pe același rând.`,
  );
  section("COD SCHIMBAT pe același rând + aceeași descriere", codeDrift);
  section("DESCRIERE SCHIMBATĂ pe același rând + același cod", descDrift);
  section("Rânduri fără produs pe același rând în DB", noRow.slice(0, 40));
  if (noRow.length > 40) console.log(`  … încă ${noRow.length - 40}`);

  // 5. produse din DB care nu mai apar deloc în pricelistul curent (nici pe cod, nici
  // pe descriere) — candidați la „scos din producție" de furnizor.
  const sheetDescs = new Set(sheet.map((r) => clean(r.desc)));
  const sheetCodeKeys = new Set(sheet.filter((r) => r.code).map((r) => canon(r.code!)));
  const gone = products.filter(
    (p) =>
      // universalele fără cod au descriere compusă, nu se caută în foaie pe text
      p.fitment.carModel.brand.name !== "UNIVERSAL" &&
      !sheetDescs.has(clean(p.description)) &&
      !(p.externalCode && sheetCodeKeys.has(canon(p.externalCode))),
  );
  section(
    "DB: produse care nu mai apar deloc în pricelist",
    gone.map(
      (p) =>
        `${p.importKey} | stoc ${p.stock ?? 0} | ${p.externalCode ?? "∅"} | ${p.fitment.label} | ${p.description}`,
    ),
  );

  // 6. igienă: cod gol scris ca string vid în loc de NULL — se comportă altfel la
  // căutări și la potrivirea pe cod.
  section(
    "DB: externalCode = '' în loc de NULL",
    products
      .filter((p) => p.externalCode === "")
      .map((p) => `${p.importKey} | ${p.fitment.label} | ${p.description}`),
  );

  // 4. coduri din DB care nu mai apar nicăieri în pricelist
  const sheetCodes = new Set([...sheetByCode.keys()]);
  const orphans = products
    .filter((p) => p.externalCode && !sheetCodes.has(canon(p.externalCode)))
    .map((p) => `${p.sourceRow} | ${p.externalCode} | ${p.fitment.label} | ${p.description}`);
  section("DB: coduri care nu mai apar în pricelist", orphans.slice(0, 40));
  if (orphans.length > 40) console.log(`  … încă ${orphans.length - 40}`);
}

main().finally(() => prisma.$disconnect());
