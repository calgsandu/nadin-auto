import { NextRequest } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/access";
import { getInventoryHistory } from "@/lib/operations/inventory-progress";

/** Câte produse pe o cerere: cât încape în „Numără rămasele" (100), cu loc. */
const MAX_PRODUCTS = 200;

/** Mini-istoricul de la inventar: ultimele numărători ale pieselor într-un depozit. */
export async function GET(request: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) {
    return new Response("Neautentificat", { status: 401 });
  }
  const warehouseId = request.nextUrl.searchParams.get("warehouseId")?.trim();
  const productIds = [
    ...new Set(
      (request.nextUrl.searchParams.get("productIds") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_PRODUCTS);
  if (!warehouseId || productIds.length === 0) {
    return Response.json({ history: {} });
  }
  return Response.json({ history: await getInventoryHistory(productIds, warehouseId) });
}
