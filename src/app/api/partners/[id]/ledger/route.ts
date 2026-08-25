import { getCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { getPartnerLedger } from "@/lib/partners/debt";

/**
 * Fișa unui partener, cerută la deschiderea drawerului.
 *
 * Nu se preîncarcă în pagină: lista de parteneri ar fi purtat 50 de mișcări
 * pentru fiecare rând, deși se deschide una singură.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentAppUser();
  if (!user) return new Response("Neautentificat", { status: 401 });
  if (!canWriteCatalog(user.role)) {
    return new Response("Fără drept", { status: 403 });
  }

  const { id } = await params;
  return Response.json(await getPartnerLedger(id));
}
