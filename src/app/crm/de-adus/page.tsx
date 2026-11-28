import { Suspense } from "react";
import { CircleCheck, ClipboardList, PackageX } from "lucide-react";
import { getOperationsData, getRestockTransferPrefill, type OperationsData } from "@/lib/operations/queries";
import type { RestockTransferPrefill } from "@/lib/operations/restock";
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
  const prefill = canModify ? await getRestockTransferPrefill(operations) : null;
  return <RestockWorkspace canModify={canModify} operations={operations} prefill={prefill} />;
}

function RestockWorkspace({
  canModify,
  operations,
  prefill,
}: {
  canModify: boolean;
  operations: OperationsData;
  prefill: RestockTransferPrefill | null;
}) {
  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-3">
      {canModify ? (
        <div className="flex justify-end">
          {/* Cu poziții de adus, transferul pleacă gata completat spre 110A. */}
          <StockTransferDialog warehouses={toWarehouseOptions(operations.warehouses)} prefill={prefill ?? undefined} />
        </div>
      ) : null}
      <div className="stat-strip grid sm:grid-cols-3">
        <DailyMetric icon={ClipboardList} label="Poziții active" value={formatNumber(operations.restockPending.length)} />
        <DailyMetric icon={CircleCheck} label="Aduse azi" value={formatNumber(operations.restockDeliveredToday.length)} />
        <DailyMetric icon={PackageX} label="Fără stoc" value={formatNumber(operations.restockUnavailable.length)} />
      </div>
      {operations.restockPending.length === 0 ? (
        <div className="crm-card px-3 py-10 text-center text-sm text-(--c-muted)">Nu sunt produse de adus în Pavilion 110A.</div>
      ) : (
      <div className="overflow-hidden crm-card">
        <div className="overflow-x-auto">
          {/* Lista se folosește și de pe telefon, la raft: sub lg codul trece
              lângă denumire și rămân Produs, Cantitate și bifele. */}
          <table className="crm-table w-full border-collapse text-left text-sm lg:min-w-[980px]">
            <thead className="border-b border-(--c-line) bg-(--c-surface-2)">
              <tr>
                <TableHead className="max-lg:hidden">Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right" secondary>Solicitări</TableHead>
                <TableHead align="right">De adus</TableHead>
                <TableHead secondary>Prima vânzare</TableHead>
                {canModify ? <TableHead align="right">Bifează</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {operations.restockPending.map((line) => (
                  <tr key={line.productId} className="motion-table-row border-t border-(--c-line-2) hover:bg-(--c-surface-2)">
                    <TableCell className="font-mono text-xs font-semibold max-lg:hidden">
                      {formatText(line.product.externalCode)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {line.product.externalCode ? (
                        <span className="block font-mono text-sm font-bold lg:hidden">{line.product.externalCode}</span>
                      ) : null}
                      {line.product.description}
                      <VehicleSubline product={line.product} />
                    </TableCell>
                    <TableCell align="right" secondary className="tabular-nums">{formatNumber(line.taskCount)}</TableCell>
                    <TableCell align="right" className="tabular-nums font-semibold">{formatNumber(line.quantity)}</TableCell>
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
                ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </section>
  );
}

