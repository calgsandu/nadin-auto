import { requireCurrentAppUser } from "@/lib/auth/access";
import { canWriteCatalog } from "@/lib/roles";
import { xlsxResponse } from "@/lib/export/xlsx";
import { buildMonthWorkbook } from "@/lib/export/month-file";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Dosarul lunii pentru contabil. Conținutul stă în `buildMonthWorkbook`. */
export async function GET(request: Request) {
  const user = await requireCurrentAppUser();
  if (!canWriteCatalog(user.role)) {
    return new Response("Acces interzis", { status: 403 });
  }

  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  const { workbook, filename } = await buildMonthWorkbook(month);
  return xlsxResponse(workbook, filename);
}
