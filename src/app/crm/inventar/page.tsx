import Link from "next/link";
import { Suspense } from "react";
import { Download, FileText } from "lucide-react";
import { InventoryDialog } from "@/app/operations/inventory-dialog";
import { DocumentDetailsButton } from "@/app/operations/document-details";
import { DocumentRowActions } from "@/app/operations/document-row-actions";
import { getInventoryData, type InventoryData } from "@/lib/operations/queries";
import { crmInventoryHref } from "@/lib/crm/urls";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, PagerLink, TableCell, TableHead, VehicleSubline, WorkspaceSkeleton } from "../_components/ui";
import { toDocLines, toDocumentDetails } from "../_components/documents-table";
import { formatDate, formatMoney, formatNumber, formatText, signedNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ wh?: string; from?: string; to?: string; ipage?: string }>;
}) {
  const appUser = await requireCrmSection("inventar");
  const params = await searchParams;
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getInventoryData(params);
  const key = [params.wh, params.from, params.to, params.ipage].join(":");

  return (
    <>
      <CrmHeader section="inventar" role={appUser.role} />
      <Suspense key={key} fallback={<WorkspaceSkeleton cards={2} filters={3} rows={6} />}>
        <Loader dataPromise={dataPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  canModify,
}: {
  dataPromise: Promise<InventoryData>;
  canModify: boolean;
}) {
  const data = await dataPromise;
  return <InventoryWorkspace data={data} canModify={canModify} />;
}

function InventoryWorkspace({ data, canModify }: { data: InventoryData; canModify: boolean }) {
  const totalQuantity = data.stocks.reduce((sum, row) => sum + row.quantity, 0);
  const warehouseOptions = data.warehouses.map((w) => ({ id: w.id, name: w.name }));

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {data.warehouses.map((warehouse) => {
          const active = warehouse.id === data.selected?.id;
          return (
            <Link
              key={warehouse.id}
              href={crmInventoryHref({ wh: warehouse.id, ...data.filters })}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-[#1b1a17] bg-[#1b1a17] text-white"
                  : "border-[#e8e7e3] bg-white text-[#1b1a17] hover:bg-[#f6f6f4]"
              }`}
            >
              {warehouse.name}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DailyMetric label="Poziții în depozit" value={formatNumber(data.stocks.length)} />
        <DailyMetric label="Bucăți în depozit" value={formatNumber(totalQuantity)} />
      </div>

      {canModify ? (
        <div className="flex justify-end">
          <InventoryDialog warehouses={warehouseOptions} defaultWarehouseId={data.selected?.id} />
        </div>
      ) : null}

      <InventoryOperationsTable data={data} canModify={canModify} />

      <details className="motion-card group overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 marker:content-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#1b1a17]">
                Stoc în sistem — {data.selected?.name ?? "fără depozit"}
              </h2>
              <p className="mt-1 text-sm text-[#6f6b63]">
                {formatNumber(data.stocks.length)} poziții, {formatNumber(totalQuantity)} bucăți
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[#6f6b63] group-open:hidden">
              Arată
            </span>
            <span className="hidden shrink-0 text-sm font-semibold text-[#6f6b63] group-open:inline">
              Ascunde
            </span>
          </div>
        </summary>
        <div className="overflow-x-auto border-t border-[#e8e7e3]">
          <table className="crm-table w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Preț vânzare</TableHead>
                <TableHead align="right">În sistem</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.stocks.length > 0 ? (
                data.stocks.map((row) => (
                  <tr key={row.id} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatText(row.product.externalCode)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.product.description}
                      <VehicleSubline product={row.product} />
                    </TableCell>
                    <TableCell align="right" className="font-mono">
                      {row.product.salePriceLei != null ? `${formatMoney(row.product.salePriceLei)} lei` : "—"}
                    </TableCell>
                    <TableCell align="right" className="font-mono font-semibold">
                      {formatNumber(row.quantity)}
                    </TableCell>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={4}>
                    Nu există stoc înregistrat în acest depozit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

    </section>
  );
}

/** Inventarele trecute ale depozitului selectat: filtre, detalii, export, editare, ștergere. */
function InventoryOperationsTable({
  data,
  canModify,
}: {
  data: InventoryData;
  canModify: boolean;
}) {
  const { operations, filters, page, pageCount, total, pageSize, selected } = data;
  const warehouseOptions = data.warehouses.map((warehouse) => ({
    id: warehouse.id,
    name: warehouse.name,
  }));
  const filterInputCls =
    "h-10 rounded-md border border-[#e8e7e3] bg-white px-2.5 text-sm text-[#1b1a17]";
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const exportQuery = new URLSearchParams({
    wh: selected?.id ?? "",
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }).toString();

  return (
    <div className="grid gap-3">
      <form
        action="/crm/inventar"
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border border-[#e8e7e3] bg-white px-3 py-3"
      >
        <input type="hidden" name="wh" value={selected?.id ?? ""} />
        <label className="grid gap-1 text-xs font-semibold text-[#6f6b63]">
          De la
          <input className={filterInputCls} type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6f6b63]">
          Până la
          <input className={filterInputCls} type="date" name="to" defaultValue={filters.to} />
        </label>
        <button
          type="submit"
          className="button-primary h-10 rounded-md bg-[#1b1a17] px-4 text-sm font-semibold text-white hover:bg-[#33312c]"
        >
          Filtrează
        </button>
        <Link
          href={crmInventoryHref({ wh: selected?.id })}
          className="h-10 content-center px-2 text-sm font-medium text-[#1b1a17] underline decoration-[#2e90fa] underline-offset-4"
        >
          Resetează
        </Link>
        {canModify && selected ? (
          <div className="flex gap-2">
            <a
              href={`/api/export/inventory?${exportQuery}`}
              className="button-secondary inline-flex h-10 items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
            >
              <Download className="size-4" aria-hidden="true" /> Toate (Excel)
            </a>
            <a
              href={`/api/export/inventory?${exportQuery}&format=pdf`}
              className="button-secondary inline-flex h-10 items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
            >
              <FileText className="size-4" aria-hidden="true" /> Toate (PDF)
            </a>
          </div>
        ) : null}
        <span className="ml-auto text-sm text-[#6f6b63]">
          {start}-{end} din {formatNumber(total)} inventare
        </span>
      </form>

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="border-b border-[#e8e7e3] px-4 py-3">
          <h2 className="font-semibold text-[#1b1a17]">Inventare efectuate</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="crm-table w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
            <tr>
              <TableHead>Data</TableHead>
              <TableHead>Document</TableHead>
              <TableHead align="right" secondary>Poziții</TableHead>
              <TableHead align="right" secondary>Plus</TableHead>
              <TableHead align="right" secondary>Minus</TableHead>
              <TableHead align="right">Net</TableHead>
              <TableHead secondary>Notițe</TableHead>
              <TableHead align="right">Acțiuni</TableHead>
            </tr>
          </thead>
          <tbody>
            {operations.length > 0 ? (
              operations.map((operation) => {
                const plus = operation.lines.reduce((sum, line) => sum + Math.max(line.quantity, 0), 0);
                const minus = operation.lines.reduce((sum, line) => sum + Math.min(line.quantity, 0), 0);
                const docLines = toDocLines(operation);
                return (
                  <tr key={operation.id} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                    <TableCell>{formatDate(operation.documentDate)}</TableCell>
                    <TableCell className="font-semibold">Inventar #{operation.number}</TableCell>
                    <TableCell align="right" secondary className="tabular-nums">{formatNumber(operation.lines.length)}</TableCell>
                    <TableCell align="right" secondary className="tabular-nums text-[#15803d]">{plus > 0 ? `+${plus}` : "—"}</TableCell>
                    <TableCell align="right" secondary className="tabular-nums text-[#b91c1c]">{minus < 0 ? minus : "—"}</TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{signedNumber(plus + minus)}</TableCell>
                    <TableCell secondary className="text-[#6f6b63]">
                      {operation.notes?.replace(/^Inventar:?\s*/, "") || "—"}
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-2">
                        <DocumentDetailsButton details={toDocumentDetails(operation, canModify)} />
                        {canModify ? (
                          <>
                            <a
                              href={`/api/export/inventory/${operation.id}`}
                              className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                            >
                              <Download className="size-3.5" aria-hidden="true" /> Excel
                            </a>
                            <a
                              href={`/api/export/inventory/${operation.id}?format=pdf`}
                              className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                            >
                              <FileText className="size-3.5" aria-hidden="true" /> PDF
                            </a>
                            <DocumentRowActions
                              id={operation.id}
                              title={`Inventar #${operation.number}`}
                              documentDate={operation.documentDate.toISOString().slice(0, 10)}
                              documentType={operation.type}
                              notes={operation.notes ?? ""}
                              partnerId={operation.partner?.id ?? ""}
                              partnerName={operation.partner?.name ?? ""}
                              warehouses={warehouseOptions}
                              warehouseId={operation.warehouseId}
                              lines={docLines}
                            />
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={8}>
                  Nu există inventare salvate pentru filtrele curente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-[#6f6b63]">
            Pagina {page} din {pageCount}
          </p>
          <div className="flex gap-2">
            <PagerLink
              disabled={page <= 1}
              href={crmInventoryHref({ wh: selected?.id, ...filters, ipage: page - 1 })}
              label="Înapoi"
            />
            <PagerLink
              disabled={page >= pageCount}
              href={crmInventoryHref({ wh: selected?.id, ...filters, ipage: page + 1 })}
              label="Înainte"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

