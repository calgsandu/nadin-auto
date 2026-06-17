import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProductSearchWhere,
  normalizeProductSearchQuery,
  PRODUCT_SEARCH_LIMIT,
  toProductSearchResult,
} from "@/lib/catalog/product-search";

export async function GET(request: NextRequest) {
  const query = normalizeProductSearchQuery(
    request.nextUrl.searchParams.get("q") ?? "",
  );
  const products = await prisma.product.findMany({
    where: query ? buildProductSearchWhere(query) : undefined,
    include: {
      type: true,
      fitment: {
        include: {
          carModel: {
            include: {
              brand: true,
            },
          },
        },
      },
    },
    orderBy: [{ fitment: { carModel: { brand: { name: "asc" } } } }, { sourceRow: "asc" }],
    take: PRODUCT_SEARCH_LIMIT,
  });

  return Response.json({
    products: products.map(toProductSearchResult),
  });
}
