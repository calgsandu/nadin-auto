import { Suspense } from "react";
import { getOperationsData, type OperationsData } from "@/lib/operations/queries";
import { RestockCheckbox } from "@/app/operations/restock-checkbox";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, TableCell, TableHead, VehicleSubline, WorkspaceSkeleton } from "../_components/ui";
import { formatDate, formatNumber, formatText } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function UnavailableRestockPage() {
  const appUser = await requireCrmSection("fara-stoc");
  const operationsPromise = getOperationsData("fara-stoc");

  return (
    <>
      <CrmHeader section="fara-stoc" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={2} rows={5} />}>
        <Loader canModify={canWriteCatalog(appUser.role)} operationsPromise={operationsPromise} />
      </Suspense>
    </>
  );
}

async function Loader({
  canModify,
  operationsPromise,
}: {
  canModify: boolean;
  operationsPromise: Promise<OperationsData>;
}) {
  const operations = await operationsPromise;
  return <UnavailableRestockWorkspace canModify={canModify} operations={operations} />;
}

function UnavailableRestockWorkspace({
  canModify,
  operations,
}: {
  canModify: boolean;
  operations: OperationsData;
}) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <DailyMetric label="Poziții fără stoc" value={formatNumber(operations.restockUnavailable.length)} />
        <DailyMetric
          label="Cantitate totală"
          value={formatNumber(
            operations.restockUnavailable.reduce((sum, line) => sum + line.quantity, 0),
          )}
        />
      </div>
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="border-b border-[#e8e7e3] px-4 py-3">
          <h2 className="font-semibold text-[#1b1a17]">Marcate fără stoc</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Cantitate</TableHead>
                <TableHead secondary>Ultima vânzare</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {operations.restockUnavailable.length > 0 ? (
                operations.restockUnavailable.map((line) => (
                  <tr key={line.productId} className="motion-table-row border-t border-[#efeeeb]">
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatText(line.product.externalCode)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {line.product.description}
                      <VehicleSubline product={line.product} />
                    </TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{formatNumber(line.quantity)}</TableCell>
                    <TableCell secondary>{formatDate(line.latestRequestedAt)}</TableCell>
                    {canModify ? (
                      <TableCell align="right">
                        {/* „Nu mai este" era o ușă cu un singur sens. */}
                        <RestockCheckbox
                          kind="pending"
                          label="Readu în lista de adus"
                          productId={line.productId}
                          warehouseId={line.warehouseId}
                        />
                      </TableCell>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={canModify ? 5 : 4}>
                    Nu sunt produse marcate fără stoc.
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

