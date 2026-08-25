import { Suspense } from "react";
import { getOperationsData, type OperationsData } from "@/lib/operations/queries";
import { ReturnDialog, type ReturnableSale } from "@/app/operations/return-dialog";
import { DocumentRowActions } from "@/app/operations/document-row-actions";
import { lineDescription } from "@/lib/operations/line-display";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, TableCell, TableHead, VehicleSubline, WorkspaceSkeleton } from "../_components/ui";
import { documentTotalLei, toDocLines } from "../_components/documents-table";
import { formatDate, formatMoney, formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReturnsPage() {
  const appUser = await requireCrmSection("retururi");
  const canModify = canWriteCatalog(appUser.role);
  const operationsPromise = getOperationsData("retururi");

  return (
    <>
      <CrmHeader section="retururi" role={appUser.role} />
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
  return <ReturnsWorkspace canModify={canModify} operations={operations} />;
}

function ReturnsWorkspace({
  canModify,
  operations,
}: {
  canModify: boolean;
  operations: OperationsData;
}) {
  const totalReturnedLei = operations.returns.reduce(
    (total, document) => total + Number(document.totalLei ?? 0),
    0,
  );
  // The dialog offers the most recent 30 sales to return from.
  const returnableSales: ReturnableSale[] = operations.salesArchive
    .slice(0, 30)
    .map((sale) => ({
      id: sale.id,
      number: sale.number,
      dateLabel: formatDate(sale.documentDate),
      warehouseName: sale.warehouse.name,
      partnerName: sale.partner?.name ?? null,
      lines: sale.lines.flatMap((line) =>
        line.productId && line.product
          ? [{
              productId: line.productId,
              label: `${line.product.externalCode ? `${line.product.externalCode} · ` : ""}${line.product.description}`,
              quantity: line.quantity,
              unitPriceLei: Number(line.unitPriceEuro ?? 0),
            }]
          : [],
      ),
    }));

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <DailyMetric label="Retururi înregistrate" value={formatNumber(operations.returns.length)} />
        <DailyMetric label="Valoare returnată" value={`${formatMoney(totalReturnedLei)} lei`} />
      </div>
      {canModify ? (
        <div className="flex justify-end">
          <ReturnDialog sales={returnableSales} />
        </div>
      ) : null}
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Data</TableHead>
                <TableHead>Document</TableHead>
                <TableHead secondary>Depozit</TableHead>
                <TableHead>Produse</TableHead>
                <TableHead align="right" secondary>Cantitate</TableHead>
                <TableHead align="right">Total</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {operations.returns.length > 0 ? (
                operations.returns.map((document) => (
                  <tr key={document.id} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                    <TableCell>{formatDate(document.documentDate)}</TableCell>
                    <TableCell className="font-semibold">
                      Retur #{document.number}
                      {document.notes ? (
                        <p className="mt-0.5 text-xs font-normal text-[#6f6b63]">{document.notes}</p>
                      ) : null}
                    </TableCell>
                    <TableCell secondary>{document.warehouse.name}</TableCell>
                    <TableCell>
                      <div className="grid gap-1">
                        {document.lines.map((line) => (
                          <span key={line.id}>
                            {line.product?.externalCode ? (
                              <span className="mr-1.5 font-semibold text-[#1b1a17]">{line.product.externalCode}</span>
                            ) : null}
                            {lineDescription(line)}
                            <span className="font-mono text-[#6f6b63]"> x{line.quantity}</span>
                            <VehicleSubline product={line.product} />
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell align="right" secondary className="tabular-nums">
                      {formatNumber(document.lines.reduce((sum, line) => sum + line.quantity, 0))}
                    </TableCell>
                    <TableCell align="right" className="font-mono font-semibold">
                      {formatMoney(documentTotalLei(document))} lei
                    </TableCell>
                    {canModify ? (
                      <TableCell align="right">
                        <DocumentRowActions
                          id={document.id}
                          title={`Retur #${document.number}`}
                          documentDate={document.documentDate.toISOString().slice(0, 10)}
                          documentType={document.type}
                          notes={document.notes ?? ""}
                          partnerId={document.partner?.id ?? ""}
                          partnerName={document.partner?.name ?? ""}
                          lines={toDocLines(document)}
                        />
                      </TableCell>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={canModify ? 7 : 6}>
                    Nu există retururi încă.
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

