import { assertCanFulfillPaymentAccount } from "@/lib/payment-accounts/status";

type FulfillablePaymentAccount = {
  id: string;
  number: number;
  warehouseId: string;
  partnerId: string;
  cancelledAt: Date | null;
  fulfilledAt: Date | null;
  totalGross: number;
  notes: string | null;
  lines: {
    productId: string;
    quantity: number;
    unitPriceGross: number;
  }[];
};

export function buildPaymentAccountSaleData(
  account: FulfillablePaymentAccount,
  documentDate: Date,
) {
  assertCanFulfillPaymentAccount({
    cancelledAt: account.cancelledAt,
    fulfilledAt: account.fulfilledAt,
    paidAt: null,
  });

  return {
    type: "SALE" as const,
    documentDate,
    warehouseId: account.warehouseId,
    partnerId: account.partnerId,
    notes: `Cont de plată #${account.number}${account.notes ? `. ${account.notes}` : ""}`,
    totalLei: account.totalGross,
    lines: account.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPriceEuro: line.unitPriceGross,
    })),
  };
}
