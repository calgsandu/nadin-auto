import { Download, FileText } from "lucide-react";
import { productLineLabel, productLineSubtitle, type ProductLineInfo } from "@/lib/catalog/product-line-label";
import type { VehicleFitmentInfo } from "@/lib/catalog/vehicle-label";
import { COMPANY } from "@/lib/company";
import type { OperationsData } from "@/lib/operations/queries";
import type { SalePaymentMethodStatus } from "@/lib/operations/sale-payment-method";
import { CashRegisterBadge, CashRegisterControl } from "@/app/operations/cash-register-control";
import { SalePaymentMethodBadge, SalePaymentMethodControl } from "@/app/operations/sale-payment-method-control";
import { DocumentDetailsButton, type DocumentDetailsValue } from "@/app/operations/document-details";
import { DocumentRowActions } from "@/app/operations/document-row-actions";
import { lineDescription } from "@/lib/operations/line-display";
import type { SupplierOption, WarehouseOption } from "@/app/operations/stock-document-dialog";
import { TableCell, TableHead, VehicleSubline } from "./ui";
import { dateTimeFormat, formatDate, formatDocumentType, formatMoney, formatNumber } from "./format";

export type SaleLineWithProduct = {
  id: string;
  quantity: number;
  unitPriceEuro: { toString(): string } | null;
  externalName: string | null;
  externalCode: string | null;
  product: {
    externalCode: string | null;
    description: string;
    salePriceLei: { toString(): string } | null;
    fitment: VehicleFitmentInfo;
  } | null;
};

/** Rând secundar gri cu marca + model + ani sub denumirea produsului. */

export function SaleLines({ lines }: { lines: SaleLineWithProduct[] }) {
  return (
    <div className="grid gap-1">
      {lines.map((line) => {
        const sold = line.unitPriceEuro != null ? Number(line.unitPriceEuro) : null;
        const list = line.product?.salePriceLei != null ? Number(line.product.salePriceLei) : null;
        const diff = sold != null && list != null ? sold - list : 0;
        const marked = sold != null && list != null && diff !== 0;

        return (
          <span key={line.id}>
            {(line.product?.externalCode ?? line.externalCode) ? (
              <span className="mr-1.5 font-semibold text-[#1b1a17]">
                {line.product?.externalCode ?? line.externalCode}
              </span>
            ) : null}
            {lineDescription(line)}
            {!line.product ? (
              <span
                className="ml-1.5 rounded bg-[#dbebfe] px-1 text-xs font-semibold text-[#175cd3]"
                title="Piesă de la furnizor — nu face parte din catalogul/stocul propriu"
              >
                extern
              </span>
            ) : null}
            <span className="font-mono text-[#6f6b63]"> x{line.quantity}</span>
            {sold != null ? (
              <span
                className={`ml-1.5 whitespace-nowrap rounded px-1 font-mono text-xs font-semibold ${
                  marked
                    ? diff < 0
                      ? "bg-[#fee2e2] text-[#b91c1c]"
                      : "bg-[#dbebfe] text-[#175cd3]"
                    : "text-[#6f6b63]"
                }`}
                title={
                  marked
                    ? `Preț catalog: ${formatMoney(list)} lei (diferență ${diff > 0 ? "+" : ""}${formatMoney(diff)} lei)`
                    : undefined
                }
              >
                {formatMoney(sold)} lei{marked ? (diff < 0 ? " ↓" : " ↑") : ""}
              </span>
            ) : null}
            <VehicleSubline product={line.product} />
          </span>
        );
      })}
    </div>
  );
}


export function documentTotalLei(doc: {
  totalLei: { toString(): string } | null;
  totalEuro: { toString(): string } | null;
  lines: { quantity: number; unitCostLei: { toString(): string } | null; unitPriceEuro: { toString(): string } | null }[];
}): number {
  if (doc.totalLei != null) return Number(doc.totalLei);
  if (doc.totalEuro != null) return Number(doc.totalEuro);
  return doc.lines.reduce(
    (sum, l) => sum + l.quantity * Number(l.unitCostLei ?? l.unitPriceEuro ?? 0),
    0,
  );
}

export function toDocLines(doc: {
  type: string;
  lines: {
    productId: string | null;
    externalName: string | null;
    externalCode: string | null;
    externalSupplierId: string | null;
    quantity: number;
    unitPriceEuro: { toString(): string } | null;
    unitCostLei: { toString(): string } | null;
    product: ProductLineInfo | null;
  }[];
}) {
  const usesSalePrice = doc.type === "SALE" || doc.type === "RETURN";
  return doc.lines.map((l) => {
    const price = usesSalePrice ? l.unitPriceEuro : l.unitCostLei;
    return {
      productId: l.productId ?? "",
      // Aceeași etichetă ca la căutarea din dialogul de creare: cod, mașină, tip, denumire.
      label: l.product
        ? productLineLabel(l.product)
        : `${l.externalCode ? `${l.externalCode} ` : ""}${l.externalName ?? "Piesă externă"}`,
      quantity: String(l.quantity),
      price: price != null ? String(price) : "",
      externalName: l.externalName ?? "",
      externalCode: l.externalCode ?? "",
      externalSupplierId: l.externalSupplierId ?? "",
      // Pe linii externe unitCostLei = costul de achiziție.
      externalCost: !l.productId && l.unitCostLei != null ? String(l.unitCostLei) : "",
    };
  });
}

export function toDocumentDetails(
  doc: {
    id: string;
    type: string;
    number: number;
    documentDate: Date;
    createdAt: Date;
    updatedAt: Date;
    notes: string | null;
    cashRegistered: boolean | null;
    paymentMethod: SalePaymentMethodStatus;
    externalNumber: string | null;
    discountPercent: { toString(): string } | null;
    totalLei: { toString(): string } | null;
    totalEuro: { toString(): string } | null;
    warehouse: { name: string };
    partner: { name: string; phone: string | null } | null;
    lines: {
      id: string;
      productId: string | null;
      externalName: string | null;
      externalCode: string | null;
      quantity: number;
      unitPriceEuro: { toString(): string } | null;
      unitCostLei: { toString(): string } | null;
      product: {
        description: string;
        externalCode: string | null;
        fitment: {
          yearStart: number | null;
          yearEnd: number | null;
          yearOpenEnded: boolean;
          carModel: { name: string; brand: { name: string } };
        };
      } | null;
    }[];
  },
  canExport: boolean,
): DocumentDetailsValue {
  const usesSalePrice = doc.type === "SALE" || doc.type === "RETURN";
  return {
    id: doc.id,
    typeLabel: formatDocumentType(doc.type),
    number: doc.number,
    date: formatDate(doc.documentDate),
    warehouse: doc.warehouse.name,
    partnerLabel: usesSalePrice ? "Client" : "Furnizor",
    partner: doc.partner?.name ?? null,
    partnerPhone: doc.partner?.phone ?? null,
    notes: doc.notes,
    createdAt: dateTimeFormat.format(doc.createdAt),
    updatedAt: dateTimeFormat.format(doc.updatedAt),
    totalLei: documentTotalLei(doc),
    isSale: doc.type === "SALE",
    cashRegistered: doc.cashRegistered,
    paymentMethod: doc.paymentMethod,
    externalNumber: doc.externalNumber,
    discountPercent: doc.discountPercent == null ? null : Number(doc.discountPercent),
    lines: doc.lines.map((line) => {
      const price = usesSalePrice ? line.unitPriceEuro : line.unitCostLei;
      return {
        id: line.id,
        code: line.product?.externalCode ?? line.externalCode ?? (line.product ? null : "extern"),
        description: lineDescription(line),
        vehicle: line.product ? productLineSubtitle(line.product) : null,
        quantity: line.quantity,
        price: price != null ? Number(price) : null,
      };
    }),
    canExport,
    showVat: COMPANY.vatPayer,
  };
}

/** Export „Registrul vânzărilor" (PDF/Excel) pe un interval de date. */

export function SalesRegisterExport() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);
  const inputCls =
    "h-9 rounded-md border border-[#e8e7e3] bg-white px-2 text-sm text-[#1b1a17]";
  const buttonCls =
    "button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]";

  return (
    <form
      action="/api/export/sales-register"
      method="get"
      target="_blank"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e8e7e3] bg-white px-3 py-2"
    >
      <span className="text-xs font-semibold text-[#6f6b63]">Registru vânzări</span>
      <input className={inputCls} type="date" name="from" defaultValue={firstOfMonth} aria-label="De la" />
      <input className={inputCls} type="date" name="to" defaultValue={today} aria-label="Până la" />
      <button className={buttonCls} type="submit" name="format" value="pdf">
        <FileText className="size-3.5" aria-hidden="true" /> PDF
      </button>
      <button className={buttonCls} type="submit" name="format" value="xlsx">
        <Download className="size-3.5" aria-hidden="true" /> Excel
      </button>
    </form>
  );
}


export function RecentDocumentsTable({
  documents,
  canModify = false,
  suppliers = [],
  warehouses = [],
  emptyText = "Nu există documente încă.",
}: {
  documents: OperationsData["receipts"];
  canModify?: boolean;
  suppliers?: SupplierOption[];
  warehouses?: WarehouseOption[];
  emptyText?: string;
}) {
  return (
    <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
      <div className="overflow-x-auto">
        <table className="crm-table w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
            <tr>
              <TableHead>Data</TableHead>
              <TableHead>Document</TableHead>
              <TableHead secondary>Depozit</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead align="right" secondary>Cantitate</TableHead>
              <TableHead align="right">Total</TableHead>
              {COMPANY.vatPayer ? <TableHead align="right" secondary>TVA (÷6)</TableHead> : null}
              <TableHead secondary>Casă</TableHead>
              <TableHead secondary>Plată</TableHead>
              <TableHead align="right">Acțiuni</TableHead>
            </tr>
          </thead>
          <tbody>
            {documents.length > 0 ? documents.map((document) => {
              const docTotal = documentTotalLei(document);
              return (
              <tr key={document.id} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                <TableCell>{formatDate(document.documentDate)}</TableCell>
                <TableCell className="font-semibold">{formatDocumentType(document.type)} #{document.number}</TableCell>
                <TableCell secondary>{document.warehouse.name}</TableCell>
                <TableCell>
                  {document.type === "SALE" ? (
                    <SaleLines lines={document.lines} />
                  ) : (
                    <div className="grid gap-1">
                      {document.lines.map((line) => (
                        <span key={line.id}>
                          {line.product
                            ? line.product.description
                            : `${line.externalCode ? `${line.externalCode} ` : ""}${line.externalName ?? "Piesă externă"}`}
                          <span className="font-mono text-[#6f6b63]"> x{line.quantity}</span>
                          <VehicleSubline product={line.product} />
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell align="right" secondary className="font-mono">
                  {formatNumber(document.lines.reduce((sum, line) => sum + line.quantity, 0))}
                </TableCell>
                <TableCell align="right" className="font-mono font-semibold">{formatMoney(docTotal)} lei</TableCell>
                {COMPANY.vatPayer ? (
                  <TableCell align="right" secondary className="font-mono text-[#6f6b63]">{formatMoney(docTotal / 6)} lei</TableCell>
                ) : null}
                <TableCell secondary>
                  {document.type === "SALE" ? (
                    <div className="grid gap-2">
                      <CashRegisterBadge value={document.cashRegistered} />
                      {canModify ? (
                        <CashRegisterControl
                          documentId={document.id}
                          value={document.cashRegistered}
                        />
                      ) : null}
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell secondary>
                  {document.type === "SALE" ? (
                    <div className="grid gap-2">
                      <SalePaymentMethodBadge value={document.paymentMethod} />
                      {canModify ? (
                        <SalePaymentMethodControl
                          documentId={document.id}
                          value={document.paymentMethod}
                        />
                      ) : null}
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-2">
                    <DocumentDetailsButton details={toDocumentDetails(document, canModify)} />
                    {canModify ? (
                      <DocumentRowActions
                        id={document.id}
                        title={`${formatDocumentType(document.type)} #${document.number}`}
                        documentDate={document.documentDate.toISOString().slice(0, 10)}
                        documentType={document.type}
                        notes={document.notes ?? ""}
                        partnerId={document.partner?.id ?? ""}
                        partnerName={document.partner?.name ?? ""}
                        suppliers={suppliers}
                        warehouses={warehouses}
                        warehouseId={document.warehouseId}
                        lines={toDocLines(document)}
                        isTransfer={Boolean(document.transferGroupId)}
                      />
                    ) : null}
                  </div>
                </TableCell>
              </tr>
              );
            }) : (
              <tr>
                <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={COMPANY.vatPayer ? 10 : 9}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
