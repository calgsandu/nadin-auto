import { requireCurrentAppUser } from "@/lib/auth/access";
import { buildPaymentAccountEFacturaXml } from "@/lib/e-factura/payment-account";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireCurrentAppUser();
  const { id } = await params;
  const account = await prisma.paymentAccount.findUnique({
    where: { id },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });

  if (!account) return new Response("Cont de plată inexistent", { status: 404 });
  if (account.cancelledAt) return new Response("Contul de plată este anulat", { status: 409 });
  if (!account.fulfilledAt) {
    return new Response("XML-ul fiscal poate fi generat numai după predarea mărfii", { status: 409 });
  }

  const xml = buildPaymentAccountEFacturaXml({
    ...account,
    lines: account.lines.map((line) => ({
      ...line,
      unitPriceNet: Number(line.unitPriceNet),
      totalNet: Number(line.totalNet),
      totalVat: Number(line.totalVat),
      totalGross: Number(line.totalGross),
    })),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="efactura-cont-${account.number}.xml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
