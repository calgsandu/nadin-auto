import { prisma } from "@/lib/prisma";
import { getCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";

/**
 * Opțiunile formularului de produs, cerute la nevoie.
 *
 * Formularul e randat și din interiorul altor dialoguri (creezi piesa lipsă
 * direct din recepție sau din vânzare), iar paginile de operațiuni nu au
 * brandurile/modelele/tipurile — `getOperationsData` a fost subțiat intenționat
 * ca navigarea să nu mai plătească întregul catalog. Se cer o singură dată pe
 * sesiune de pagină, la prima deschidere.
 *
 * Se întorc doar câmpurile de care are nevoie formularul: obiectele Prisma
 * întregi ar trece prin JSON cu datele calendaristice devenite text.
 */
export async function GET() {
  const user = await getCurrentAppUser();
  if (!user) {
    return new Response("Neautentificat", { status: 401 });
  }
  if (!canWriteCatalog(user.role)) {
    return new Response("Fără drept de scriere în catalog", { status: 403 });
  }

  const [brands, models, types, warehouses] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // TOATE modelele, nu doar cele ale unui brand: formularul comută brandul
    // fără să mai poată cere ceva de la server.
    prisma.carModel.findMany({
      select: { id: true, name: true, brandId: true },
      orderBy: { name: "asc" },
    }),
    prisma.productType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({
      where: { active: true },
      select: { id: true, name: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);

  return Response.json({ brands, models, types, warehouses });
}
