import "dotenv/config";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  normalizeCode,
  normalizeText,
  parseProductDescription,
} from "@/lib/catalog/parse-product";
import { canon, fixTypos, stripMarkers } from "@/lib/catalog/pricelist-text";

// ponytail: diff-import pentru un pricelist nou + marcare piese LOCAL. Dry-run
// implicit; scrie doar cu --apply. `--key=` dă prefixul de importKey al rulării
// (pl2508 = 29.08.2025, pl2601 = 26.01.2026).
//
// ATENȚIE la fiecare pricelist nou: dacă „Produse noi pe MODEL nou" sare la sute,
// aproape sigur ALIASES de mai jos e vechi față de numele modelelor din DB, nu are
// furnizorul modele noi. Verifică înainte de --apply, altfel dublezi catalogul.

const args = process.argv.slice(2).filter((a) => a !== "--");
const workbookPath = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const KEY_PREFIX = args.find((a) => a.startsWith("--key="))?.slice("--key=".length) ?? "pl2601";
if (!workbookPath)
  throw new Error("Usage: tsx scripts/import-local-diff.ts <file.xlsx> [--key=pl2601] [--apply]");

// Secțiunile de final n-au vehicul: intră sub marca UNIVERSAL, pe modelul lor.
const UNIVERSAL_BRAND = "UNIVERSAL";
const UNIVERSAL_SECTIONS: Array<[string, string]> = [
  ["ȘTERGĂTOARE", "ȘTERGĂTOARE"],
  ["LUBRIFIANTI", "LUBRIFIANȚI"],
];

const BRAND_PREFIXES = [
  "MERCEDES-BENZ", "MERCEDES", "MB", "VOLKSWAGEN", "VW", "FORD", "FIAT",
  "RENAULT", "OPEL", "TOYOTA", "HONDA", "HYUNDAI", "NISSAN", "MAZDA",
  "PEUGEOT", "CITROEN", "SKODA", "SEAT", "SUZUKI", "SUBARU", "MITSUBISHI",
  "KIA", "DACIA", "DAEWOO", "CHEVROLET", "DODGE", "IVECO", "BMW", "AUDI",
  "VOLVO", "ROVER", "LAND ROVER", "VAZ", "MOSKVICI",
];

function titleCaseRo(value: string) {
  const lower = value.toLocaleLowerCase("ro");
  return lower.charAt(0).toLocaleUpperCase("ro") + lower.slice(1);
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

// scoate tokenurile de ani de la final (`/94-06/`, `/06+`, ` 96-14 `), oricâte ar fi:
// unele celule le lipesc („MB DELFIN /06-18/ /18+").
const YEAR_TOKEN = /\s*\/\s*\d{2,4}(?:\s*-\s*\d{2,4})?\s*\+?\s*\/?\s*$/;
function stripYearTokens(input: string) {
  let s = input.trim();
  for (let guard = 0; guard < 5 && YEAR_TOKEN.test(s); guard += 1) {
    s = s.replace(YEAR_TOKEN, "").trim();
  }
  return s;
}

// model-cell → cheie model (fără brand, fără anii finali)
function modelKeyFromCell(cell: string) {
  let s = cleanModelCell(cell).toUpperCase();
  // scoate DOAR tokenul de ani de la final, prefixat cu slash: /94-06/, /06+, / 96-14 /
  s = stripYearTokens(s);
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
    // nomenclatura furnizorului → modelele din DB (redenumite la auditul din 07.2026)
    DELFIN: "SPRINTER906DELFIN",
    SPRINTER906: "SPRINTER906DELFIN",
    SPRINTER906907: "SPRINTER906DELFIN",
    DELFIN907: "SPRINTER907DELFIN",
    SPRINTER907: "SPRINTER907DELFIN",
    REX: "VARIOREX",
    VARIO: "VARIOREX",
    REXVARIO: "VARIOREX",
    VITOVIANO: "VITOW639",
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
  s = stripYearTokens(s);
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
  // orderBy fix: pricelistul are grupuri de produse cu descriere identică pe același
  // fitment, iar harta de descrieri păstrează ultimul scris — fără ordine stabilă,
  // două rulări aleg gemeni diferiți.
  const products = await prisma.product.findMany({
    select: { id: true, externalCode: true, description: true, fitmentId: true, isLocal: true, notes: true, sourceRow: true },
    orderBy: { id: "asc" },
  });
  const alreadyLocal = new Set(products.filter((p) => p.isLocal).map((p) => p.id));
  const byFitment = new Map<string, { codes: Map<string, string[]>; descs: Map<string, string[]> }>();
  const codeOf = new Map(products.map((p) => [p.id, p.externalCode]));
  const descOf = new Map(products.map((p) => [p.id, canon(stripMarkers(p.description).desc)]));
  const rowOf = new Map(products.map((p) => [p.id, p.sourceRow]));
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
      if (p.externalCode) {
        const codeKey = canon(p.externalCode);
        if (!bucket.codes.has(codeKey)) bucket.codes.set(codeKey, []);
        bucket.codes.get(codeKey)!.push(p.id);
      }
      const descKey = canon(cleaned);
      if (!bucket.descs.has(descKey)) bucket.descs.set(descKey, []);
      bucket.descs.get(descKey)!.push(p.id);
    }
  }

  // Un cod nou pe o descriere care există deja NU e aceeași piesă: pricelistul are
  // zeci de piese cu descriere identică și coduri diferite (stânga/dreapta, variante
  // de bază). Cădem pe descriere doar când rândul vine fără cod, sau când produsul
  // din DB n-are încă niciun cod — atunci pricelistul doar i-l completează.
  const claimed = new Set<string>();
  const accounted = new Set<number>();
  const dropped: string[] = [];
  const codeChanges: Array<{ id: string; from: string | null; to: string; desc: string }> = [];
  type Bucket = { codes: Map<string, string[]>; descs: Map<string, string[]> };

  // Potrivire pe CONSUM, nu pe „există sau nu": pricelistul repetă aceeași descriere
  // pe zeci de piese diferite, iar importul inițial a făcut un produs per rând. Fără
  // consum, două rânduri distincte se potrivesc cu același produs din DB și al doilea
  // se pierde tăcut. Fiecare produs din DB poate fi revendicat o singură dată.
  function take(ids: string[] | undefined) {
    const hit = ids?.find((id) => !claimed.has(id));
    if (hit) claimed.add(hit);
    return hit ?? null;
  }
  function resolveExisting(
    bucket: Bucket | undefined,
    code: string | null,
    desc: string,
    sheetRow: number,
  ) {
    if (!bucket) return null;
    const descKey = canon(desc);
    if (!code) return take(bucket.descs.get(descKey));

    // `canon` scoate spațiile și liniuțele, deci „P22802 1" și „P22802-1" cad pe
    // aceeași cheie deși sunt piese diferite — preferă candidatul a cărui descriere
    // se potrivește, ca să nu se lege perechi greșite.
    const sameCode = bucket.codes.get(canon(code)) ?? [];
    const byCode = take(sameCode.filter((id) => descOf.get(id) === descKey)) ?? take(sameCode);
    if (byCode) return byCode;

    const sameDesc = bucket.descs.get(descKey) ?? [];
    // Produs din DB fără cod: pricelistul doar i-l completează.
    const uncoded = take(sameDesc.filter((id) => !codeOf.get(id)));
    if (uncoded) return uncoded;

    // Același rând-sursă + aceeași descriere + același model, dar alt cod = furnizorul
    // a schimbat codul între versiuni de pricelist, nu e piesă nouă. Fără regula asta
    // ar intra un duplicat lângă produsul cu codul vechi.
    const renamed = take(sameDesc.filter((id) => rowOf.get(id) === sheetRow));
    if (renamed) {
      codeChanges.push({ id: renamed, from: codeOf.get(renamed) ?? null, to: code, desc });
      return renamed;
    }

    // Cod nou pe o descriere existentă, pe alt rând = piesă nouă.
    return null;
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
  const universalRows: Array<BaseRow & { line: string; model: string }> = [];
  const toMarkLocal = new Set<string>();
  const unmatchedModels = new Map<string, number>();
  let matched = 0;
  let sectionLocal = false;
  let universal: string | null = null;
  const stopped = false;

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  for (let i = 1; i < rows.length && !stopped; i++) {
    const row = rows[i] ?? [];
    const [itemV, codeV, modelV, descV] = row;
    const first = normalizeText(itemV);

    if (first && !codeV && !modelV && !descV) {
      const upper = first.toUpperCase();
      // Secțiunile fără vehicul (ștergătoare, lubrifianți) merg pe altă ramură:
      // coloana C ține linia de produs, nu un model auto.
      universal = UNIVERSAL_SECTIONS.find(([marker]) => upper.includes(marker))?.[1] ?? null;
      sectionLocal = /\/\s*LOCAL\s*\//i.test(first);
      continue;
    }
    if (!modelV) continue;
    accounted.add(i + 1);

    if (universal) {
      // C = linia de produs (ALCA SUPER FLAT, MASTICA 2kg), D = descrierea (poate lipsi).
      // „ALCA SPECIAL / START" → „ALCA SPECIAL/START", altfel parseNotes citește
      // linia ca a doua notă între slash-uri.
      const line = normalizeText(modelV).replace(/\s*\/\s*/g, "/");
      const body = normalizeText(descV).replace(/см/gi, "cm");
      const label = body ? `${body} ${line}` : titleCaseRo(line);
      universalRows.push({
        sourceRow: i + 1,
        model: universal,
        line,
        code: normalizeCode(codeV),
        desc: fixTypos(label),
        isLocal: sectionLocal,
        stock: num(row[stockIdx]),
        priceEuro: num(row[priceIdx]),
        costLei: num(row[costIdx]),
      });
      continue;
    }

    if (!descV) {
      accounted.delete(i + 1); // rând de umplutură: doar modelul e tras în jos
      continue;
    }

    const modelCell = normalizeText(modelV);
    const { desc: rawDesc, isLocal: rowLocal } = stripMarkers(normalizeText(descV));
    const desc = fixTypos(rawDesc);
    if (!desc) {
      dropped.push(`${i + 1} | descriere goală după curățarea markerelor: ${normalizeText(descV)}`);
      continue;
    }
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
      // Celulele care lipesc două intervale („MB DELFIN /06-18/ /18+") cad aici deși
      // piesa există deja pe alt interval al aceluiași model — o căutăm pe toate
      // fitmenturile modelului înainte s-o declarăm fitment nou.
      const onSiblings = candidates
        .map((f) => resolveExisting(byFitment.get(f.id), code, desc, i + 1))
        .find(Boolean);
      if (onSiblings) {
        matched++;
        if (isLocal && !alreadyLocal.has(onSiblings)) toMarkLocal.add(onSiblings);
        continue;
      }
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
    const existingId = resolveExisting(bucket, code, desc, i + 1);

    if (existingId) {
      matched++;
      if (isLocal && !alreadyLocal.has(existingId)) toMarkLocal.add(existingId);
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

  // rulare repetată: universalele intrate deja stau pe fitmenturile mărcii UNIVERSAL
  const universalFitmentIds = new Set(
    fitments.filter((f) => f.carModel.brand.name === UNIVERSAL_BRAND).map((f) => f.id),
  );
  const universalSeen = new Set<string>();
  for (const fid of universalFitmentIds) {
    const bucket = byFitment.get(fid);
    for (const key of bucket?.codes.keys() ?? []) universalSeen.add(`c:${key}`);
    for (const key of bucket?.descs.keys() ?? []) universalSeen.add(`d:${key}`);
  }
  const universalNew = universalRows.filter(
    (r) => !universalSeen.has(`d:${canon(r.desc)}`) && !(r.code && universalSeen.has(`c:${canon(r.code)}`)),
  );

  // produse din DB cu markere rămase în text
  const dirty = products.filter(
    (p) =>
      stripMarkers(p.description).desc !== p.description ||
      /(^|;\s*)local(\s*;|$)/i.test(p.notes ?? ""),
  );

  console.log(`Rânduri potrivite cu DB: ${matched}`);
  console.log(`Produse noi de inserat (fitment existent): ${toInsert.length}`);
  console.log(`Produse noi pe FITMENT nou (model existent): ${newFitmentRows.length}`);
  console.log(`Produse noi pe MODEL nou: ${newModelRows.length}`);
  console.log(`Produse universale noi (ștergătoare/lubrifianți): ${universalNew.length} din ${universalRows.length}`);
  const classified =
    matched + toInsert.length + newFitmentRows.length + newModelRows.length + universalRows.length;
  if (classified !== accounted.size)
    dropped.push(`clasificate ${classified} vs rânduri de produs ${accounted.size}`);
  console.log(`Rânduri de produs neclasificate: ${dropped.length}`);
  for (const d of dropped) console.log(`   ${d}`);
  console.log(`Coduri schimbate de furnizor: ${codeChanges.length}`);
  for (const c of codeChanges) console.log(`   ${c.from ?? "∅"} → ${c.to} | ${c.desc}`);
  console.log(`Produse existente de marcat LOCAL: ${toMarkLocal.size}`);
  if (process.env.DEBUG_LOCAL)
    for (const id of toMarkLocal)
      console.log("   LOCAL:", products.find((p) => p.id === id)?.description);
  console.log(`Produse DB cu markere ZZZ//local/ de curățat: ${dirty.length}`);
  if (universalNew.length) {
    console.log(`\nUniversale noi:`);
    for (const r of universalNew)
      console.log(`  ${r.model} | ${r.code ?? "∅"} | ${r.desc} | stoc ${r.stock ?? 0} | lei ${r.costLei ?? "∅"}`);
  }
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

  // universale: marca UNIVERSAL, câte un model per secțiune, un singur fitment fără ani
  if (universalNew.length) {
    const brand = await prisma.brand.upsert({
      where: { name: UNIVERSAL_BRAND },
      create: { name: UNIVERSAL_BRAND },
      update: {},
    });
    for (const modelName of new Set(universalNew.map((r) => r.model))) {
      const model = await prisma.carModel.upsert({
        where: { brandId_name: { brandId: brand.id, name: modelName } },
        create: { brandId: brand.id, name: modelName },
        update: {},
      });
      const fitment = (await prisma.vehicleFitment.upsert({
        where: { carModelId_label: { carModelId: model.id, label: modelName } },
        create: { carModelId: model.id, label: modelName },
        update: {},
        include: { carModel: { include: { brand: true } } },
      })) as (typeof fitments)[number];
      for (const r of universalNew.filter((row) => row.model === modelName)) {
        toInsert.push({ ...r, fitment });
      }
    }
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
        importKey: `${KEY_PREFIX}:${r.sourceRow}`,
        source: "EXCEL",
        sourceRow: r.sourceRow,
        externalCode: r.code,
        description: r.desc,
        notes: cleanNotes(parsed.notes),
        // Stocul din pricelist NU e stocul nostru: după resetul din 2026-08-07 stocul vine
        // doar din inventar/recepții. Coloana din foaie băga bucăți fantomă în Depozit principal.
        stock: 0,
        priceEuro: r.priceEuro,
        costLei: r.costLei,
        isLocal: r.isLocal,
        fitmentId: r.fitment.id,
        typeId: types.get(parsed.typeName)!,
        productFitments: { create: [{ fitmentId: r.fitment.id }] },
        warehouseStocks: {
          create: [{ warehouseId: defaultWarehouse.id, quantity: 0 }],
        },
      },
    });
    inserted++;
    if (r.isLocal) toMarkLocal.delete(product.id);
  }

  for (const c of codeChanges) {
    await prisma.product.update({ where: { id: c.id }, data: { externalCode: c.to } });
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

  console.log(
    `\nAplicat: ${inserted} inserate, ${codeChanges.length} coduri actualizate, ${toMarkLocal.size} marcate LOCAL, ${dirty.length} curățate.`,
  );
}

main().finally(() => prisma.$disconnect());
