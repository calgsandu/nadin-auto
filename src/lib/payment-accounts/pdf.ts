import { COMPANY } from "@/lib/company";
import {
  createPdf,
  drawTable,
  pdfMoney,
  type PdfColumn,
} from "@/lib/export/pdf";
import { moneyToRomanianWords } from "@/lib/payment-accounts/totals";

export type PaymentAccountPdfData = {
  number: number;
  issueDate: Date;
  dueDate: Date | null;
  customerName: string;
  customerAddress: string;
  customerIdno: string;
  customerVatCode: string | null;
  customerPhone: string | null;
  customerIban: string | null;
  customerBankName: string | null;
  customerBankCode: string | null;
  notes: string | null;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  lines: {
    productCode: string | null;
    description: string;
    unitOfMeasure: string;
    quantity: number;
    unitPriceNet: number;
    totalNet: number;
    totalVat: number;
    totalGross: number;
  }[];
};

const formatDate = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function createPaymentAccountPdf(account: PaymentAccountPdfData) {
  const pdf = createPdf();
  const left = pdf.page.margins.left;
  const fullWidth = pdf.page.width - left - pdf.page.margins.right;

  pdf.font("bold").fontSize(12).fillColor("#1b1a17").text(COMPANY.legalName, left, 42, { width: 285 });
  pdf.font("regular").fontSize(8.2).fillColor("#4f4b44");
  pdf.text(`Adresa: ${COMPANY.address}`, left, 61, { width: 285 });
  pdf.text(`IDNO: ${COMPANY.idno}   Cod TVA: ${COMPANY.vatCode}`, left, 73, { width: 285 });
  pdf.text(`IBAN: ${COMPANY.iban}`, left, 85, { width: 285 });
  pdf.text(`${COMPANY.bankName}   BIC: ${COMPANY.bankCode}`, left, 97, { width: 285 });

  pdf.font("bold").fontSize(12).fillColor("#1b1a17").text("CONT DE PLATĂ", 340, 43, { width: 215, align: "right" });
  pdf.font("bold").fontSize(9).text("FACTURĂ PROFORMĂ", 340, 59, { width: 215, align: "right" });
  pdf.font("regular").fontSize(9).text(`nr. ${account.number} din ${formatDate.format(account.issueDate)}`, 340, 75, { width: 215, align: "right" });
  if (account.dueDate) {
    pdf.fillColor("#6f6b63").fontSize(8).text(`Scadent la ${formatDate.format(account.dueDate)}`, 340, 89, { width: 215, align: "right" });
  }

  pdf.moveTo(left, 118).lineTo(left + fullWidth, 118).strokeColor("#c9c7c1").lineWidth(0.7).stroke();
  pdf.y = 130;
  pdf.x = left;
  pdf.font("bold").fontSize(8.5).fillColor("#6f6b63").text("PLĂTITOR / DESTINATAR", left, pdf.y, { width: fullWidth });
  pdf.moveDown(0.25);
  pdf.font("bold").fontSize(10).fillColor("#1b1a17").text(account.customerName, left, pdf.y, { width: fullWidth });
  pdf.font("regular").fontSize(8.5).fillColor("#33312c");
  pdf.text(`Adresa: ${account.customerAddress}`, left, pdf.y, { width: fullWidth });
  pdf.text(`IDNO: ${account.customerIdno}${account.customerVatCode ? `   Cod TVA: ${account.customerVatCode}` : ""}`, left, pdf.y, { width: fullWidth });
  if (account.customerIban) pdf.text(`IBAN: ${account.customerIban}`, left, pdf.y, { width: fullWidth });
  if (account.customerBankName || account.customerBankCode) {
    pdf.text(`${account.customerBankName ?? ""}${account.customerBankCode ? `   BIC: ${account.customerBankCode}` : ""}`, left, pdf.y, { width: fullWidth });
  }
  if (account.customerPhone) pdf.text(`Telefon: ${account.customerPhone}`, left, pdf.y, { width: fullWidth });
  pdf.moveDown(1);

  const columns: PdfColumn[] = [
    { header: "Nr.", width: 25, align: "center" },
    { header: "Denumirea mărfii", width: 185 },
    { header: "U.M.", width: 35, align: "center" },
    { header: "Cant.", width: 40, align: "right" },
    { header: "Preț fără TVA", width: 60, align: "right" },
    { header: "Suma fără TVA", width: 65, align: "right" },
    { header: "TVA", width: 47, align: "right" },
    { header: "Total", width: 58, align: "right" },
  ];
  const rows = account.lines.map((line, index) => [
    String(index + 1),
    `${line.productCode ? `${line.productCode} · ` : ""}${line.description}`,
    line.unitOfMeasure,
    String(line.quantity),
    pdfMoney.format(line.unitPriceNet),
    pdfMoney.format(line.totalNet),
    pdfMoney.format(line.totalVat),
    pdfMoney.format(line.totalGross),
  ]);
  rows.push(
    ["", "", "", "", "", "Fără TVA", "", pdfMoney.format(account.totalNet)],
    ["", "", "", "", "", `TVA ${COMPANY.vatRate * 100}%`, "", pdfMoney.format(account.totalVat)],
    ["", "", "", "", "", "TOTAL", "", pdfMoney.format(account.totalGross)],
  );
  drawTable(pdf, columns, rows, { boldRows: new Set([rows.length - 1]), fontSize: 7.6 });

  if (pdf.y > pdf.page.height - 190) pdf.addPage();
  pdf.moveDown(1.5);
  pdf.x = left;
  pdf.font("bold").fontSize(9).fillColor("#1b1a17").text(`Total pentru achitare: ${moneyToRomanianWords(account.totalGross)}`, left, pdf.y, { width: fullWidth });
  if (account.notes) {
    pdf.moveDown(0.6);
    pdf.font("regular").fontSize(8.5).text(`Mențiuni: ${account.notes}`, left, pdf.y, { width: fullWidth });
  }

  pdf.moveDown(2);
  const signatureY = pdf.y;
  pdf.font("regular").fontSize(8.5);
  pdf.text(`Director: ${COMPANY.director}`, left, signatureY, { width: 230 });
  pdf.text(`Contabil-șef: ${COMPANY.chiefAccountant}`, 325, signatureY, { width: 230 });
  const disclaimerY = signatureY + 48;
  pdf.roundedRect(left, disclaimerY, fullWidth, 38, 4).fillAndStroke("#fffbeb", "#f2b23e");
  pdf.font("bold").fontSize(8.5).fillColor("#92400e").text(
    "DOCUMENT COMERCIAL · NU REPREZINTĂ FACTURĂ FISCALĂ",
    left + 10,
    disclaimerY + 7,
    { width: fullWidth - 20, align: "center" },
  );
  pdf.font("regular").fontSize(7.5).fillColor("#6f6b63").text(
    "Factura fiscală se emite separat prin SIA e-Factura.",
    left + 10,
    disclaimerY + 21,
    { width: fullWidth - 20, align: "center" },
  );
  pdf.y = disclaimerY + 38;

  return pdf;
}
