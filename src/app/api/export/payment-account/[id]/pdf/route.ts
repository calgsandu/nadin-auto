import { requireCurrentAppUser } from "@/lib/auth/access";
import { pdfResponse } from "@/lib/export/pdf";
import { createPaymentAccountPdf } from "@/lib/payment-accounts/pdf";
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

  const pdf = createPaymentAccountPdf({
    ...account,
    totalNet: Number(account.totalNet),
    totalVat: Number(account.totalVat),
    totalGross: Number(account.totalGross),
    lines: account.lines.map((line) => ({
      ...line,
      unitPriceNet: Number(line.unitPriceNet),
      totalNet: Number(line.totalNet),
      totalVat: Number(line.totalVat),
      totalGross: Number(line.totalGross),
    })),
  });
  return pdfResponse(pdf, `cont-de-plata-${account.number}.pdf`);
}
