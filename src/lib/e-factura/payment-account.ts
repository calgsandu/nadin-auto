import { COMPANY } from "@/lib/company";
import { buildEFacturaXml } from "@/lib/e-factura/xml";

export type PaymentAccountEFacturaData = {
  id: string;
  issueDate: Date;
  fulfilledAt: Date | null;
  customerIdno: string;
  customerIban: string | null;
  lines: Array<{
    productCode: string | null;
    description: string;
    unitOfMeasure: string;
    quantity: number;
    unitPriceNet: number;
    totalNet: number;
    totalVat: number;
    totalGross: number;
  }>;
};

export function buildPaymentAccountEFacturaXml(account: PaymentAccountEFacturaData) {
  return buildEFacturaXml({
    deliveryDate: account.fulfilledAt ?? account.issueDate,
    reference: `payment-account:${account.id}`,
    supplier: {
      idno: COMPANY.idno,
      bankAccount: COMPANY.iban,
    },
    buyer: {
      idno: account.customerIdno,
      bankAccount: account.customerIban,
    },
    lines: account.lines.map((line) => ({
      code: line.productCode,
      name: line.description,
      unitOfMeasure: line.unitOfMeasure.replace(/\.$/, "") || "buc",
      quantity: line.quantity,
      unitPriceWithoutVat: line.unitPriceNet,
      totalWithoutVat: line.totalNet,
      vatRate: line.totalVat > 0 ? COMPANY.vatRate * 100 : 0,
      totalVat: line.totalVat,
      total: line.totalGross,
    })),
  });
}
