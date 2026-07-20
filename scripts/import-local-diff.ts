import "dotenv/config";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  normalizeCode,
  normalizeText,
  parseProductDescription,
} from "@/lib/catalog/parse-product";

// ponytail: one-off diff-import pentru PRAIS-LIST 29.08.2025 + marcare piese LOCAL.
// Dry-run implicit; scrie doar cu --apply.

const args = process.argv.slice(2).filter((a) => a !== "--");
const workbookPath = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
if (!workbookPath) throw new Error("Usage: tsx scripts/import-local-diff.ts <file.xlsx> [--apply]");

const LOCAL_RE = /\/\s*local\s*\/?/gi;

function stripMarkers(raw: string) {
  let d = raw.replace(/ZZZ/g, " ");
  const isLocal = LOCAL_RE.test(d);
  d = d.replace(LOCAL_RE, " ");
  d = d.replace(/\s+/g, " ").trim();
  return { desc: d, isLocal };
}

function canon(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9ĂÂÎȘȚ]+/g, "");
}

const BRAND_PREFIXES = [
  "MERCEDES-BENZ", "MERCEDES", "MB", "VOLKSWAGEN", "VW", "FORD", "FIAT",
  "RENAULT", "OPEL", "TOYOTA", "HONDA", "HYUNDAI", "NISSAN", "MAZDA",
  "PEUGEOT", "CITROEN", "SKODA", "SEAT", "SUZUKI", "SUBARU", "MITSUBISHI",
  "KIA", "DACIA", "DAEWOO", "CHEVROLET", "DODGE", "IVECO", "BMW", "AUDI",
  "VOLVO", "ROVER", "LAND ROVER",
];

const TYPO_FIXES: Array<[RegExp, string]> = [
  [/Mîiner/g, "Mâner"],
  [/mîiner/g, "mâner"],
  [/Mecanizm/g, "Mecanism"],
  [/mecanizm/g, "mecanism"],
  [/Diuză/g, "Duză"],
  [/diuză/g, "duză"],
  [/Stîlp/g, "Stâlp"],
  [/stîlp/g, "stâlp"],
  [/Jgheag/g, "Jgheab"],
  [/jgheag/g, "jgheab"],
];

function fixTypos(s: string) {
  return TYPO_FIXES.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

// curăță celula de model: dash-uri multiple/agățate, spații
function cleanModelCell(cell: string) {
  return cell
    .replace(/\s*-{2,}\s*/g, " ")
    .replace(/\s-\s/g, " ")
    .replace(/-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// model-cell → cheie model (fără brand, fără anii finali)
function modelKeyFromCell(cell: string) {
  let s = cleanModelCell(cell).toUpperCase();
  // scoate DOAR tokenul de ani de la final, prefixat cu slash: /94-06/, /06+, / 96-14 /
  s = s.replace(/\s*\/\s*\d{2,4}(?:\s*-\s*\d{2,4})?\s*\+?\s*\/?\s*$/, "").trim();
  for (const b of BRAND_PREFIXES) {
    if (s.startsWith(b + " ") || s.startsWith(b + "-") || s === b) {
      s = s.slice(b.length).replace(/^-/, "").trim();
      break;
    }
  }
  let key = canon(s);
  const ALIASES: Record<string, string> = {
    CRV1: "CRVI",
    CRV2: "CRVII",
    LT35: "LT3545",
    POLOH: "POLOHB",
    COROLLAE14: "COROLLAE14E15",
    E15: "COROLLAE14E15",
    ROVERFREELANDER: "FREELANDER",
    // nomenclatura nouă a furnizorului → modelele existente în DB
    SPRINTER906: "DELFIN",
    SPRINTER906907: "DELFIN",
    SPRINTER907: "DELFIN907",
    VITOVIANO: "VITOW639",
    REXVARIO: "REX",
    GOLFIIJETTA: "GOLFII",
    GOLFIIJETTAII: "GOLFII",
    GOLFIIIVENTO: "GOLFIII",
    IBIZACORDOBA: "IBIZA",
    LACETTINUBIRA: "LACETTI",
    SERENAVANETTE: "SERENA",
    "240260": "240",
    S40V40: "S40",
  };
  key = ALIASES[key] ?? key;
  return key;
}

// pentru modele complet noi: brand + nume model din celulă
function newModelFromCell(cell: string): { brand: string; model: string } | null {
  let s = cleanModelCell(cell);
  s = s.replace(/\s*\/\s*\d{2,4}(?:\s*-\s*\d{2,4})?\s*\+?\s*\/?\s*$/, "").trim();
  const upper = s.toUpperCase();
  const SHORT: Record<string, string> = { MB: "MERCEDES-BENZ", MERCEDES: "MERCEDES-BENZ", VW: "VOLKSWAGEN" };
  for (const b of BRAND_PREFIXES) {
    if (upper.startsWith(b + " ") || upper.startsWith(b + "-")) {
      const brand = SHORT[b] ?? b;
      const model = s.slice(b.length).replace(/^-/, "").trim();
      return model ? { brand, model } : null;
    }
  }
  return null;
}

function parseYears(cell: string): { start: number | null; end: number | null; open: boolean } {
  const m = [...cell.matchAll(/(\d{2,4})\s*(?:-\s*(\d{2,4})|(\+))/g)].at(-1);
  if (!m) return { start: null, end: null, open: false };
  const norm = (v: string) => {
    const n = Number(v);
    if (v.length === 4) return n;
    return n >= 30 ? 1900 + n : 2000 + n;
  };
  return { start: norm(m[1]!), end: m[2] ? norm(m[2]) : null, open: Boolean(m[3]) };
}

function cleanNotes(notes: string | null) {
  if (!notes) return null;
  const parts = notes
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== "local");
  return parts.length ? parts.join("; ") : null;
}

async function main() {
  const wb = XLSX.readFile(workbookPath!, { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: true });

  const header = (rows[0] ?? []).map((v) => normalizeText(v));
  const priceIdx = header.findIndex((h) => h.toUpperCase().includes("PRICE EX WORKS"));
  const stockIdx = priceIdx - 1;
  const costIdx = priceIdx + 1;
  if (priceIdx < 0) throw new Error("Nu găsesc coloana PRICE EX WORKS");

  // DB lookups
  const fitments = await prisma.vehicleFitment.findMany({
    include: { carModel: { include: { brand: true } } },
  });
  const modelFitments = new Map<string, typeof fitments>();
  for (const f of fitments) {
    const key = canon(f.carModel.name);
    if (!modelFitments.has(key)) modelFitments.set(key, []);
    modelFitments.get(key)!.push(f);
  }
  const products = await prisma.product.findMany({
    select: { id: true, externalCode: true, description: true, fitmentId: true, isLocal: true, notes: true },
  });
  const byFitment = new Map<string, { codes: Map<string, string>; descs: Map<string, string> }>();
  const pf = await prisma.productFitment.findMany();
  const productFitmentIds = new Map<string, string[]>();
  for (const link of pf) {
    if (!productFitmentIds.has(link.productId)) productFitmentIds.set(link.productId, []);
    productFitmentIds.get(link.productId)!.push(link.fitmentId);
  }
  for (const p of products) {
    const fits = new Set([p.fitmentId, ...(productFitmentIds.get(p.id) ?? [])]);
    const cleaned = stripMarkers(p.description).desc;
    for (const fid of fits) {
      if (!byFitment.has(fid)) byFitment.set(fid, { codes: new Map(), descs: new Map() });
      const bucket = byFitment.get(fid)!;
      if (p.externalCode) bucket.codes.set(canon(p.externalCode), p.id);
      bucket.descs.set(canon(cleaned), p.id);
    }
  }

  type NewRow = {
    sourceRow: number;
    code: string | null;
    fitment: (typeof fitments)[number];
    desc: string;
    isLocal: boolean;
    stock: number | null;
    priceEuro: number | null;
    costLei: number | null;
  };
  type BaseRow = {
    sourceRow: number;
    code: string | null;
    desc: string;
    isLocal: boolean;
    stock: number | null;
    priceEuro: number | null;
    costLei: number | null;
  };
  const toInsert: NewRow[] = [];
  const newFitmentRows: Array<
    BaseRow & { sibling: (typeof fitments)[number]; years: ReturnType<typeof parseYears> }
  > = [];
  const newModelRows: Array<BaseRow & { modelCell: string }> = [];
  const toMarkLocal = new Set<string>();
  const unmatchedModels = new Map<string, number>();
  let matched = 0;
  let sectionLocal = false;
  const stopped = false;

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  for (let i = 1; i < rows.length && !stopped; i++) {
    const row = rows[i] ?? [];
    const [itemV, codeV, modelV, descV] = row;
    const first = normalizeText(itemV);

    if (first.toUpperCase().includes("CARENAJE RUSSIA")) break; // secțiuni speciale, ca importerul

    if (first && !codeV && !modelV && !descV) {
      sectionLocal = /\/\s*LOCAL\s*\//i.test(first);
      continue;
    }
    if (!modelV || !descV) continue;

    const modelCell = normalizeText(modelV);
    const { desc: rawDesc, isLocal: rowLocal } = stripMarkers(normalizeText(descV));
    const desc = fixTypos(rawDesc);
    if (!desc) continue;
    const isLocal = rowLocal || sectionLocal;
    const code = normalizeCode(codeV);

    const mKey = modelKeyFromCell(modelCell);
    const candidates = modelFitments.get(mKey);
    if (!candidates?.length) {
      unmatchedModels.set(modelCell, (unmatchedModels.get(modelCell) ?? 0) + 1);
      newModelRows.push({
        sourceRow: i + 1,
        modelCell,
        code,
        desc,
        isLocal,
        stock: num(row[stockIdx]),
        priceEuro: num(row[priceIdx]),
        costLei: num(row[costIdx]),
      });
      continue;
    }
    const yrs = parseYears(modelCell);
    const fitment =
      candidates.find((f) => f.yearStart === yrs.start && (yrs.open ? f.yearOpenEnded : f.yearEnd === yrs.end)) ??
      candidates.find((f) => f.yearStart === yrs.start) ??
      null;

    if (!fitment) {
      // fitment nou (interval de ani nou) pe model existent
      newFitmentRows.push({
        sourceRow: i + 1,
        sibling: candidates[0]!,
        years: yrs,
        code,
        desc,
        isLocal,
        stock: num(row[stockIdx]),
        priceEuro: num(row[priceIdx]),
        costLei: num(row[costIdx]),
      });
      continue;
    }

    const bucket = byFitment.get(fitment.id);
    const existingId =
      (code ? bucket?.codes.get(canon(code)) : undefined) ?? bucket?.descs.get(canon(desc));

    if (existingId) {
      matched++;
      if (isLocal) toMarkLocal.add(existingId);
      continue;
    }
    toInsert.push({
      sourceRow: i + 1,
      code,
      fitment,
      desc,
      isLocal,
      stock: num(row[stockIdx]),
      priceEuro: num(row[priceIdx]),
      costLei: num(row[costIdx]),
    });
  }

  // produse din DB cu markere rămase în text
  const dirty = products.filter(
    (p) => /ZZZ/.test(p.description) || LOCAL_RE.test(p.description) || /(^|;\s*)local(\s*;|$)/i.test(p.notes ?? ""),
  );

  console.log(`Rânduri potrivite cu DB: ${matched}`);
  console.log(`Produse noi de inserat (fitment existent): ${toInsert.length}`);
  console.log(`Produse noi pe FITMENT nou (model existent): ${newFitmentRows.length}`);
  console.log(`Produse noi pe MODEL nou: ${newModelRows.length}`);
  console.log(`Produse existente de marcat LOCAL: ${toMarkLocal.size}`);
  console.log(`Produse DB cu markere ZZZ//local/ de curățat: ${dirty.length}`);
  if (newFitmentRows.length) {
    console.log(`\nFitmenturi noi:`);
    for (const r of newFitmentRows)
      console.log(
        `  ${r.sibling.carModel.brand.name} ${r.sibling.carModel.name} ${r.years.start}-${r.years.open ? "+" : r.years.end} | ${r.code ?? "∅"} | ${r.desc}${r.isLocal ? " [LOCAL]" : ""}`,
      );
  }
  if (newModelRows.length) {
    console.log(`\nModele noi:`);
    for (const r of newModelRows) {
      const parsed = newModelFromCell(r.modelCell);
      console.log(
        `  ${r.modelCell} → ${parsed ? `${parsed.brand} / ${parsed.model}` : "NEPARSABIL (sar)"} | ${r.code ?? "∅"} | ${r.desc}${r.isLocal ? " [LOCAL]" : ""}`,
      );
    }
  }
  console.log(`\nNoi, pe fitment existent:`);
  const bySection = new Map<string, NewRow[]>();
  for (const r of toInsert) {
    const k = r.fitment.label;
    if (!bySection.has(k)) bySection.set(k, []);
    bySection.get(k)!.push(r);
  }
  for (const [label, list] of bySection) {
    console.log(`  ${label} — ${list.length}`);
    for (const r of list)
      console.log(`     ${r.code ?? "∅"} | ${r.desc}${r.isLocal ? "  [LOCAL]" : ""} | stoc ${r.stock ?? 0}`);
  }

  if (!APPLY) {
    console.log("\nDry-run. Rulează cu --apply ca să scrie.");
    return;
  }

  const defaultWarehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
  if (!defaultWarehouse) throw new Error("Nu există depozit implicit");

  // fitmenturi noi pe modele existente
  const fitCache = new Map<string, (typeof fitments)[number]>();
  for (const r of newFitmentRows) {
    const key = `${r.sibling.carModelId}:${r.years.start}:${r.years.open ? "+" : r.years.end}`;
    let fitment = fitCache.get(key);
    if (!fitment) {
      const prefix = r.sibling.label.replace(/\s*\/?\s*\d{2,4}(?:\s*-\s*\d{2,4})?\s*\+?\s*\/?\s*$/, "").trim();
      const yy = (n: number | null) => (n === null ? "" : String(n).slice(-2));
      const label = `${prefix} /${yy(r.years.start)}${r.years.open ? "+" : `-${yy(r.years.end)}`}/`;
      fitment = (await prisma.vehicleFitment.upsert({
        where: { carModelId_label: { carModelId: r.sibling.carModelId, label } },
        create: {
          carModelId: r.sibling.carModelId,
          label,
          yearStart: r.years.start,
          yearEnd: r.years.end,
          yearOpenEnded: r.years.open,
        },
        update: {},
        include: { carModel: { include: { brand: true } } },
      })) as (typeof fitments)[number];
      fitCache.set(key, fitment);
    }
    toInsert.push({ ...r, fitment });
  }

  // modele noi
  for (const r of newModelRows) {
    const parsed = newModelFromCell(r.modelCell);
    if (!parsed) {
      console.log(`SAR (brand necunoscut): ${r.modelCell}`);
      continue;
    }
    const yrs = parseYears(r.modelCell);
    const key = `${parsed.brand}:${parsed.model}:${yrs.start}:${yrs.open ? "+" : yrs.end}`;
    let fitment = fitCache.get(key);
    if (!fitment) {
      const brand = await prisma.brand.upsert({
        where: { name: parsed.brand },
        create: { name: parsed.brand },
        update: {},
      });
      const model = await prisma.carModel.upsert({
        where: { brandId_name: { brandId: brand.id, name: parsed.model } },
        create: { brandId: brand.id, name: parsed.model },
        update: {},
      });
      const label = cleanModelCell(r.modelCell);
      fitment = (await prisma.vehicleFitment.upsert({
        where: { carModelId_label: { carModelId: model.id, label } },
        create: {
          carModelId: model.id,
          label,
          yearStart: yrs.start,
          yearEnd: yrs.end,
          yearOpenEnded: yrs.open,
        },
        update: {},
        include: { carModel: { include: { brand: true } } },
      })) as (typeof fitments)[number];
      fitCache.set(key, fitment);
    }
    toInsert.push({ ...r, fitment });
  }

  const typeNames = new Set(toInsert.map((r) => parseProductDescription(r.desc).typeName));
  await prisma.productType.createMany({
    data: [...typeNames].map((name) => ({ name })),
    skipDuplicates: true,
  });
  const types = new Map(
    (await prisma.productType.findMany({ where: { name: { in: [...typeNames] } } })).map((t) => [t.name, t.id]),
  );

  let inserted = 0;
  for (const r of toInsert) {
    const parsed = parseProductDescription(r.desc);
    const product = await prisma.product.create({
      data: {
        importKey: `pl2508:${r.sourceRow}`,
        source: "EXCEL",
        sourceRow: r.sourceRow,
        externalCode: r.code,
        description: r.desc,
        notes: cleanNotes(parsed.notes),
        stock: r.stock ?? 0,
        priceEuro: r.priceEuro,
        costLei: r.costLei,
        isLocal: r.isLocal,
        fitmentId: r.fitment.id,
        typeId: types.get(parsed.typeName)!,
        productFitments: { create: [{ fitmentId: r.fitment.id }] },
        warehouseStocks: {
          create: [{ warehouseId: defaultWarehouse.id, quantity: r.stock ?? 0 }],
        },
      },
    });
    inserted++;
    if (r.isLocal) toMarkLocal.delete(product.id);
  }

  if (toMarkLocal.size) {
    await prisma.product.updateMany({
      where: { id: { in: [...toMarkLocal] } },
      data: { isLocal: true },
    });
  }

  for (const p of dirty) {
    const { desc } = stripMarkers(p.description);
    await prisma.product.update({
      where: { id: p.id },
      data: {
        description: desc,
        notes: cleanNotes(p.notes),
        isLocal: true,
        manuallyEdited: true,
      },
    });
  }

  console.log(`\nAplicat: ${inserted} inserate, ${toMarkLocal.size} marcate LOCAL, ${dirty.length} curățate.`);
}

main().finally(() => prisma.$disconnect());
