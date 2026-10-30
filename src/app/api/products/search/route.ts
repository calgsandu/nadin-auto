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
  const user = await getCurrentAppUser();
  if (!user) {
    return new Response("Neautentificat", { status: 401 });
  }
  const includeCosts = canWriteCatalog(user.role);

  // Dreptul de a crea produsul lipsă direct din căutare vine de la server, nu
  // dintr-un prop plimbat prin cele șase dialoguri care folosesc comboboxul.
  const canCreate = canWriteCatalog(user.role);

  // `?id=` = un singur produs, pentru „Vinde" din fișa rapidă (pagina Azi).
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const product = await prisma.product.findUnique({ where: { id }, include: searchInclude });
    return Response.json({
      canCreate,
      products: product ? [toProductSearchResult(product, includeCosts)] : [],
    });
  }

  const query = normalizeProductSearchQuery(
    request.nextUrl.searchParams.get("q") ?? "",
  );
  const matchedIds = query ? await findMatchingProductIds(query) : null;
  if (matchedIds && matchedIds.length === 0) {
    return Response.json({ products: [], canCreate });
  }

  const products = await prisma.product.findMany({
    where: matchedIds ? { id: { in: matchedIds } } : undefined,
    include: searchInclude,
    orderBy: [{ fitment: { carModel: { brand: { name: "asc" } } } }, { sourceRow: "asc" }],
    take: matchedIds ? undefined : PRODUCT_SEARCH_LIMIT,
  });

  // Ordinea vine din scorul de relevanță, nu alfabetic după marcă: altfel primele
  // 20 de rezultate erau pur și simplu mărcile de la începutul alfabetului.
  const ranked = matchedIds
    ? matchedIds
        .map((id) => products.find((product) => product.id === id))
        .filter((product) => product !== undefined)
    : products;

  return Response.json({
    canCreate,
    products: ranked
      .slice(0, PRODUCT_SEARCH_LIMIT)
      .map((product) => toProductSearchResult(product, includeCosts)),
  });
}
