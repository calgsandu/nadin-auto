import { Suspense } from "react";
import { Boxes, PackageX } from "lucide-react";
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
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="stat-strip grid sm:grid-cols-2">
        <DailyMetric icon={PackageX} label="Poziții fără stoc" value={formatNumber(operations.restockUnavailable.length)} />
        <DailyMetric icon={Boxes}
          label="Cantitate totală"
          value={formatNumber(
            operations.restockUnavailable.reduce((sum, line) => sum + line.quantity, 0),
          )}
        />
      </div>
      <div className="overflow-hidden crm-card">
        <div className="border-b border-(--c-line) px-4 py-2.5">
          <h2 className="text-sm font-semibold text-(--c-ink)">Marcate fără stoc</h2>
        </div>
        {operations.restockUnavailable.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-(--c-muted)">Nu sunt produse marcate fără stoc.</p>
        ) : (
        <div className="overflow-x-auto">
          {/* Sub lg codul trece lângă denumire: fără scroll lateral pe telefon. */}
          <table className="crm-table w-full border-collapse text-left text-sm lg:min-w-[980px]">
            <thead className="border-b border-(--c-line) bg-(--c-surface-2)">
              <tr>
                <TableHead className="max-lg:hidden">Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Cantitate</TableHead>
                <TableHead secondary>Ultima vânzare</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {operations.restockUnavailable.map((line) => (
                  <tr key={line.productId} className="motion-table-row border-t border-(--c-line-2)">
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
                    <TableCell align="right" className="tabular-nums font-semibold">{formatNumber(line.quantity)}</TableCell>
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
                ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </section>
  );
}

