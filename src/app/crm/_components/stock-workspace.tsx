import type { OperationsData } from "@/lib/operations/queries";
import {
  StockDocumentDialog,
  StockTransferDialog,
} from "@/app/operations/stock-document-dialog";
import { RecentDocumentsTable } from "./documents-table";
import { toSupplierOptions, toWarehouseOptions } from "./operations-options";

/** Butonul „Adaugă recepție/transfer" din bara de sus a secțiunii. */
export async function StockAddButton({
  activeSectionId,
  operationsPromise,
}: {
  activeSectionId: "receptii" | "transferuri";
  operationsPromise: Promise<OperationsData>;
}) {
  const operations = await operationsPromise;
  const warehouses = toWarehouseOptions(operations.warehouses);
  return activeSectionId === "receptii" ? (
    <StockDocumentDialog openFromUrl suppliers={toSupplierOptions(operations.suppliers)} warehouses={warehouses} />
  ) : (
    <StockTransferDialog warehouses={warehouses} />
  );
}

export function StockWorkspace({
  activeSectionId,
  canModify,
  operations,
}: {
  activeSectionId: "receptii" | "transferuri";
  canModify: boolean;
  operations: OperationsData;
}) {
  const warehouses = toWarehouseOptions(operations.warehouses);
  const suppliers = toSupplierOptions(operations.suppliers);
  const isReceipts = activeSectionId === "receptii";
  const documents = isReceipts ? operations.receipts : operations.transfers;

  return (
    <section className="motion-page grid gap-3 p-4">
      <RecentDocumentsTable
        documents={documents}
        canModify={canModify}
        suppliers={suppliers}
        warehouses={warehouses}
        emptyText={isReceipts ? "Nicio recepție înregistrată." : "Niciun transfer înregistrat."}
      />
    </section>
  );
}
