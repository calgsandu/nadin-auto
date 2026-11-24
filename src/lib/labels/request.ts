import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCombinedCompatibilityLabel } from "@/lib/labels/format";
import {
  LABEL_SIZES,
  decodeLabelCells,
  placeLabels,
  type LabelSizeKey,
} from "@/lib/labels/layout";

/**
 * Cererea de print, aceeași pentru pagina HTML și pentru PDF: până acum fiecare
 * își avea propria copie a parsării, care trebuia ținută sincron de mână.
 */
export type LabelRequest = ReturnType<typeof parseLabelRequest>;

const clampCount = (n: number) => Math.min(Math.max(Math.round(n) || 1, 1), 50);

/** `items=id:3,id:2` → Map id→copii. Fallback: `ids=...&copies=N` (linkuri vechi). */
function parseCounts(items: string | null, ids: string | null, copies: string | null) {
  const map = new Map<string, number>();
  if (items) {
    for (const part of items.split(",")) {
      const [id, n] = part.split(":");
      if (id?.trim()) map.set(id.trim(), clampCount(Number(n)));
    }
    return map;
  }
  const perProduct = clampCount(Number(copies));
  for (const id of (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    map.set(id, perProduct);
  }
  return map;
}

export function parseLabelRequest(get: (key: string) => string | null | undefined) {
  const value = (key: string) => get(key) ?? null;
  const counts = parseCounts(value("items"), value("ids"), value("copies"));
  const alternativeCodeIds = new Set(
    (value("alt") ?? "").split(",").map((id) => id.trim()).filter(Boolean),
  );
  const sizeParam = value("size");
  const size: LabelSizeKey = sizeParam === "s" || sizeParam === "m" ? sizeParam : "l";
  const layout: "grid" | "roll" = value("layout") === "roll" ? "roll" : "grid";
  const dim = LABEL_SIZES[size];
  const perSheet = dim.cols * dim.rows;
  const skip =
    layout === "grid" ? Math.min(Math.max(Number(value("skip")) || 0, 0), perSheet - 1) : 0;

  // Așezarea liberă contează doar pe foaie; rola merge oricum la rând.
  const placed = layout === "grid" ? decodeLabelCells(value("cells"), [...counts.keys()]) : null;

  return { counts, alternativeCodeIds, size, layout, dim, perSheet, skip, placed };
}

const fitmentInclude = { include: { carModel: { include: { brand: true } } } } as const;

export const productLabelInclude = {
  type: true,
  productFitments: { include: { fitment: fitmentInclude } },
} satisfies Prisma.ProductInclude;

export type LabelProduct = Prisma.ProductGetPayload<{ include: typeof productLabelInclude }>;

export function labelCompatibility(product: LabelProduct) {
  return buildCombinedCompatibilityLabel(
    product.productFitments.map(({ fitment }) => ({
      brandName: fitment.carModel.brand.name,
      modelName: fitment.carModel.name,
      yearStart: fitment.yearStart,
      yearEnd: fitment.yearEnd,
      yearOpenEnded: fitment.yearOpenEnded,
    })),
  );
}

/** Produsele, în ordinea din cerere (nu din DB). */
export async function loadLabelProducts(ids: string[]) {
  if (ids.length === 0) return [];
  const fetched = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: productLabelInclude,
  });
  const byId = new Map(fetched.map((product) => [product.id, product]));
  return ids.map((id) => byId.get(id)).filter((product) => product !== undefined);
}

export type LabelSlot = {
  product: LabelProduct;
  copy: number;
  compatibility: string;
  includeAlternativeCode: boolean;
};

/**
 * Celula fiecărui sticker (vezi `placeLabels`). Foile sunt mereu pline: o
 * celulă goală e un loc unde poți trage un sticker.
 */
export function buildLabelSlots(request: LabelRequest, products: LabelProduct[]) {
  const byId = new Map(products.map((product) => [product.id, product]));
  const cells = placeLabels(
    products.map((product) => ({ id: product.id, count: request.counts.get(product.id) ?? 1 })),
    request.placed,
    request.skip,
  );
  const compatibility = new Map(products.map((product) => [product.id, labelCompatibility(product)]));
  const copies = new Map<string, number>();
  const slots: (LabelSlot | null)[] = cells.map((id) => {
    const product = id ? byId.get(id) : undefined;
    if (!product) return null;
    const copy = copies.get(product.id) ?? 0;
    copies.set(product.id, copy + 1);
    return {
      product,
      copy,
      compatibility: compatibility.get(product.id) ?? "",
      includeAlternativeCode: request.alternativeCodeIds.has(product.id),
    };
  });
  const labels = slots.filter((slot) => slot !== null);
  const sheets: (LabelSlot | null)[][] = [];
  for (let i = 0; i < Math.max(slots.length, 1); i += request.perSheet) {
    const sheet = slots.slice(i, i + request.perSheet);
    sheets.push([...sheet, ...Array.from({ length: request.perSheet - sheet.length }, () => null)]);
  }
  return { labels, sheets, cells };
}
