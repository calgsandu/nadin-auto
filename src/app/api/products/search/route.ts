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

export async function GET(request: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) {
    return new Response("Neautentificat", { status: 401 });
  }
  const includeCosts = canWriteCatalog(user.role);

  const query = normalizeProductSearchQuery(
    request.nextUrl.searchParams.get("q") ?? "",
  );
  const matchedIds = query ? await findMatchingProductIds(query) : null;
  if (matchedIds && matchedIds.length === 0) {
    return Response.json({ products: [] });
  }

  const products = await prisma.product.findMany({
    where: matchedIds ? { id: { in: matchedIds } } : undefined,
    include: productLabelInclude,
    orderBy: [{ fitment: { carModel: { brand: { name: "asc" } } } }, { sourceRow: "asc" }],
    take: PRODUCT_SEARCH_LIMIT,
  });

  return Response.json({
    products: products.map((product) => toProductSearchResult(product, includeCosts)),
  });
}
