import { assertCanFulfillPaymentAccount } from "@/lib/payment-accounts/status";

type FulfillablePaymentAccount = {
  id: string;
  number: number;
  warehouseId: string;
  partnerId: string;
  cancelledAt: Date | null;
  fulfilledAt: Date | null;
  paidAt: Date | null;
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
    paidAt: account.paidAt,
  });

  return {
    type: "SALE" as const,
    documentDate,
    warehouseId: account.warehouseId,
    partnerId: account.partnerId,
    /**
     * Contul de plată se achită prin bancă, nu la tejghea. Fără metodă,
     * vânzarea cădea în „Nespecificat" la închiderea de zi ȘI nu intra în
     * datoria clientului — marfa predată și neîncasată dispărea din socoteli.
     *
     * Achitat = TRANSFER (banii sunt scriși separat, ca `PartnerPayment`);
     * neachitat = CREDIT. Amândouă intră în sold și se sting la încasare.
     */
    paymentMethod: account.paidAt ? ("TRANSFER" as const) : ("CREDIT" as const),
    /** Nici transferul, nici creditul nu trec prin casa de marcat. */
    cashRegistered: false,
    notes: `Cont de plată #${account.number}${account.notes ? `. ${account.notes}` : ""}`,
    totalLei: account.totalGross,
    lines: account.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPriceEuro: line.unitPriceGross,
    })),
  };
}
