import { prisma } from "@/lib/prisma";

export async function getPaymentAccountsData() {
  const [accounts, customers, warehouses] = await Promise.all([
    prisma.paymentAccount.findMany({
      include: {
        warehouse: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
        saleDocument: { select: { id: true, number: true } },
        lines: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      take: 100,
    }),
    prisma.partner.findMany({
      where: { kind: { in: ["CUSTOMER", "BOTH"] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        idno: true,
        address: true,
      },
    }),
    prisma.warehouse.findMany({
      where: { active: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return { accounts, customers, warehouses };
}

export type PaymentAccountsData = Awaited<ReturnType<typeof getPaymentAccountsData>>;
