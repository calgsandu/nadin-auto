import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import {
  normalizeProductSearchQuery,
  PRODUCT_SEARCH_LIMIT,
  toProductSearchResult,
} from "@/lib/catalog/product-search";
import { findMatchingProductIds } from "@/lib/catalog/product-match";
import { productLabelInclude } from "@/lib/catalog/product-include";

// Stocul pe depozite doar aici: celelalte locuri care afișează eticheta n-au nevoie de el.
const searchInclude = {
  ...productLabelInclude,
  warehouseStocks: { select: { warehouseId: true, quantity: true } },
} as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code")?.trim();
  const id = params.get("id");

  // Căutarea obișnuită nu mai stă după verificarea sesiunii: pornesc împreună.
  // Fără cont rezultatul se aruncă (iar proxy.ts respinge oricum cererea înainte).
  if (!code && !id) {
    const [user, products] = await Promise.all([
      getCurrentAppUser(),
      searchProducts(normalizeProductSearchQuery(params.get("q") ?? "")),
    ]);
    if (!user) {
      return new Response("Neautentificat", { status: 401 });
    }
    const canWrite = canWriteCatalog(user.role);
    return Response.json({
      canCreate: canWrite,
      products: products.map((product) => toProductSearchResult(product, canWrite)),
    });
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return new Response("Neautentificat", { status: 401 });
  }
  const includeCosts = canWriteCatalog(user.role);

  // Dreptul de a crea produsul lipsă direct din căutare vine de la server, nu
  // dintr-un prop plimbat prin cele șase dialoguri care folosesc comboboxul.
  const canCreate = canWriteCatalog(user.role);

  // `?code=` = verificarea de cod dublat din fișa produsului (cod sau cod alternativ).
  if (code) {
    const exclude = params.get("exclude") ?? undefined;
    const match = await prisma.product.findFirst({
      where: {
        id: exclude ? { not: exclude } : undefined,
        OR: [
          { externalCode: { equals: code, mode: "insensitive" } },
          { alternativeCode: { equals: code, mode: "insensitive" } },
        ],
      },
      include: productLabelInclude,
    });
    return Response.json({
      duplicate: match ? { id: match.id, label: toProductSearchResult(match, includeCosts).label } : null,
    });
  }

  // `?id=` = un singur produs, pentru „Vinde" din fișa rapidă (pagina Azi).
  if (id) {
    const product = await prisma.product.findUnique({ where: { id }, include: searchInclude });
    return Response.json({
      canCreate,
      products: product ? [toProductSearchResult(product, includeCosts)] : [],
    });
  }

  return Response.json({ canCreate, products: [] });
}

/** Primele PRODUCT_SEARCH_LIMIT produse, în ordinea relevanței (fără căutare: alfabetic). */
async function searchProducts(query: string) {
  // Potrivirea întoarce direct cât se afișează: înainte aducea 200 de produse
  // cu toate compatibilitățile, ca ruta să păstreze doar 20.
  const matchedIds = query ? await findMatchingProductIds(query, PRODUCT_SEARCH_LIMIT) : null;
  if (matchedIds && matchedIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: matchedIds ? { id: { in: matchedIds } } : undefined,
    include: searchInclude,
    orderBy: [
      { fitment: { carModel: { brand: { name: "asc" } } } },
      { fitment: { carModel: { name: "asc" } } },
      { fitment: { yearStart: "asc" } },
      { description: "asc" },
      { id: "asc" },
    ],
    take: matchedIds ? undefined : PRODUCT_SEARCH_LIMIT,
  });
  if (!matchedIds) return products;

  // Ordinea vine din scorul de relevanță, nu alfabetic după marcă: altfel primele
  // 20 de rezultate erau pur și simplu mărcile de la începutul alfabetului.
  const byId = new Map(products.map((product) => [product.id, product]));
  return matchedIds.map((id) => byId.get(id)).filter((product) => product !== undefined);
}
