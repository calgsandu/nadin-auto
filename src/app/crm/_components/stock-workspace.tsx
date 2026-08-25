import type { OperationsData } from "@/lib/operations/queries";
import {
  StockDocumentDialog,
  StockTransferDialog,
} from "@/app/operations/stock-document-dialog";
import { RecentDocumentsTable } from "./documents-table";
import { toSupplierOptions, toWarehouseOptions } from "./operations-options";

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
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      {canModify ? (
        <div className="flex justify-end">
          {isReceipts ? (
            <StockDocumentDialog suppliers={suppliers} warehouses={warehouses} />
          ) : (
            <StockTransferDialog warehouses={warehouses} />
          )}
        </div>
      ) : null}
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

