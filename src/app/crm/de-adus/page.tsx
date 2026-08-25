import { Suspense } from "react";
import { getOperationsData, type OperationsData } from "@/lib/operations/queries";
import { StockTransferDialog } from "@/app/operations/stock-document-dialog";
import { RestockCheckbox } from "@/app/operations/restock-checkbox";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, TableCell, TableHead, VehicleSubline, WorkspaceSkeleton } from "../_components/ui";
import { toWarehouseOptions } from "../_components/operations-options";
import { formatDate, formatNumber, formatText } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function RestockPage() {
  const appUser = await requireCrmSection("de-adus");
  const canModify = canWriteCatalog(appUser.role);
  const operationsPromise = getOperationsData("de-adus");

  return (
    <>
      <CrmHeader section="de-adus" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={2} rows={5} />}>
        <Loader operationsPromise={operationsPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function Loader({
  operationsPromise,
  canModify,
}: {
  operationsPromise: Promise<OperationsData>;
  canModify: boolean;
}) {
  const operations = await operationsPromise;
  return <RestockWorkspace canModify={canModify} operations={operations} />;
}

function RestockWorkspace({
  canModify,
  operations,
}: {
  canModify: boolean;
  operations: OperationsData;
}) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="motion-card flex flex-col gap-3 rounded-xl border border-[#e8e7e3] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#1b1a17]">Reaprovizionare Pavilion 110A</h2>
          <p className="text-sm text-[#6f6b63]">
            Produsele vândute din 110A rămân aici până sunt bifate ca aduse.
          </p>
        </div>
        {canModify ? (
          <StockTransferDialog warehouses={toWarehouseOptions(operations.warehouses)} />
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <DailyMetric label="Poziții active" value={formatNumber(operations.restockPending.length)} />
        <DailyMetric label="Aduse azi" value={formatNumber(operations.restockDeliveredToday.length)} />
        <DailyMetric label="Fără stoc" value={formatNumber(operations.restockUnavailable.length)} />
      </div>
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right" secondary>Solicitări</TableHead>
                <TableHead align="right">De adus în 110A</TableHead>
                <TableHead secondary>Prima vânzare</TableHead>
                {canModify ? <TableHead align="right">Bifează</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {operations.restockPending.length > 0 ? (
                operations.restockPending.map((line) => (
                  <tr key={line.productId} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatText(line.product.externalCode)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {line.product.description}
                      <VehicleSubline product={line.product} />
                    </TableCell>
                    <TableCell align="right" secondary className="tabular-nums">{formatNumber(line.taskCount)}</TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{formatNumber(line.quantity)}</TableCell>
                    <TableCell secondary>{formatDate(line.oldestRequestedAt)}</TableCell>
                    {canModify ? (
                      <TableCell align="right">
                        <div className="flex flex-wrap justify-end gap-3">
                          <RestockCheckbox
                            kind="delivered"
                            label="Adus"
                            productId={line.productId}
                            warehouseId={line.warehouseId}
                          />
                          <RestockCheckbox
                            kind="unavailable"
                            label="Nu mai este"
                            productId={line.productId}
                            warehouseId={line.warehouseId}
                          />
                        </div>
                      </TableCell>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={canModify ? 6 : 5}>
                    Nu sunt produse de adus în Pavilion 110A.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

