import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { buildCombinedCompatibilityLabel } from "@/lib/labels/format";
import { LABEL_SIZES, type LabelSizeKey } from "@/lib/labels/layout";

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

  return { counts, alternativeCodeIds, size, layout, dim, perSheet, skip };
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

/** Fiecare copie = un sticker; `skip` celule goale în față pe foaia începută. */
export function buildLabelSlots(request: LabelRequest, products: LabelProduct[]) {
  const labels: LabelSlot[] = products.flatMap((product) => {
    const compatibility = labelCompatibility(product);
    return Array.from({ length: request.counts.get(product.id) ?? 1 }, (_, copy) => ({
      product,
      copy,
      compatibility,
      includeAlternativeCode: request.alternativeCodeIds.has(product.id),
    }));
  });
  const slots: (LabelSlot | null)[] = [
    ...Array.from({ length: request.skip }, () => null),
    ...labels,
  ];
  const sheets: (LabelSlot | null)[][] = [];
  for (let i = 0; i < slots.length; i += request.perSheet) {
    sheets.push(slots.slice(i, i + request.perSheet));
  }
  return { labels, sheets };
}
