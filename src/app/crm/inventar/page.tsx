import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ClipboardCheck, Download, FileText } from "lucide-react";
import { InventoryDialog, type InventoryPrefillItem } from "@/app/operations/inventory-dialog";
import { vehicleLabels } from "@/lib/catalog/vehicle-label";
import { DocumentDetailsButton } from "@/app/operations/document-details";
import { DocumentRowActions } from "@/app/operations/document-row-actions";
import { getInventoryData, type InventoryData } from "@/lib/operations/queries";
import { crmInventoryHref } from "@/lib/crm/urls";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import {
  FilterField,
  FilterReset,
  FilterSubmit,
  Pagination,
  segmentCls,
  segmentedCls,
  TableCell,
  TableHead,
  VehicleSubline,
  WorkspaceSkeleton,
  filterControlCls,
} from "../_components/ui";
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
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      {/* Depozitul, sumarul lui și acțiunea pe un singur rând — înainte erau trei
          rânduri (pastile, două carduri mari, butonul singur în dreapta). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className={segmentedCls}>
          {data.warehouses.map((warehouse) => {
            const active = warehouse.id === data.selected?.id;
            return (
              <Link
                key={warehouse.id}
                href={crmInventoryHref({ wh: warehouse.id, ...data.filters })}
                aria-current={active ? "page" : undefined}
                className={segmentCls(active)}
              >
                {warehouse.name}
              </Link>
            );
          })}
        </div>
        <p className="text-sm text-[#52525b]">
          <span className="font-semibold tabular-nums text-[#18181b]">{formatNumber(data.stocks.length)}</span> poziții ·{" "}
          <span className="font-semibold tabular-nums text-[#18181b]">{formatNumber(totalQuantity)}</span> bucăți
        </p>
        {canModify ? (
          <div className="ml-auto">
            <InventoryDialog
              openFromUrl
              warehouses={warehouseOptions}
              defaultWarehouseId={data.selected?.id}
              alreadyCounted={data.counted}
            />
          </div>
        ) : null}
      </div>

      {data.selected ? <CountProgress data={data} canModify={canModify} /> : null}

      <InventoryOperationsTable data={data} canModify={canModify} />

      <details className="motion-card group overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 marker:content-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[#18181b]">
                Stoc în sistem — {data.selected?.name ?? "fără depozit"}
              </h2>
              <p className="mt-1 text-sm text-[#52525b]">
                {formatNumber(data.stocks.length)} poziții, {formatNumber(totalQuantity)} bucăți
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[#52525b] group-open:hidden">
              Arată
            </span>
            <span className="hidden shrink-0 text-sm font-semibold text-[#52525b] group-open:inline">
              Ascunde
            </span>
          </div>
        </summary>
        <div className="overflow-x-auto border-t border-[#e4e4e7]">
          <table className="crm-table w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
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
                  <tr key={row.id} className="motion-table-row border-t border-[#f0f0f2] hover:bg-[#fafafa]">
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
                  <td className="px-3 py-10 text-center text-[#52525b]" colSpan={4}>
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
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const exportQuery = new URLSearchParams({
    wh: selected?.id ?? "",
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }).toString();

  return (
    <div className="grid gap-3">
      <form action="/crm/inventar" method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="wh" value={selected?.id ?? ""} />
        <FilterField icon={<CalendarDays />} label="De la" active={Boolean(filters.from)}>
          <input className={filterControlCls} type="date" name="from" defaultValue={filters.from} />
        </FilterField>
        <span className="text-[#a1a1aa]" aria-hidden="true">–</span>
        <FilterField icon={<CalendarDays />} label="Până la" active={Boolean(filters.to)}>
          <input className={filterControlCls} type="date" name="to" defaultValue={filters.to} />
        </FilterField>
        <FilterSubmit />
        {filters.from || filters.to ? <FilterReset href={crmInventoryHref({ wh: selected?.id })} /> : null}
        {canModify && selected ? (
          <div className="ml-auto flex gap-2">
            <a
              href={`/api/export/inventory?${exportQuery}`}
              className="button-secondary inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]"
            >
              <Download className="size-4 text-[#71717a]" aria-hidden="true" /> Toate (Excel)
            </a>
            <a
              href={`/api/export/inventory?${exportQuery}&format=pdf`}
              className="button-secondary inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-white px-3 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]"
            >
              <FileText className="size-4 text-[#71717a]" aria-hidden="true" /> Toate (PDF)
            </a>
          </div>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="border-b border-[#e4e4e7] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[#18181b]">Inventare efectuate</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="crm-table w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
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
                  <tr key={operation.id} className="motion-table-row border-t border-[#f0f0f2] hover:bg-[#fafafa]">
                    <TableCell>{formatDate(operation.documentDate)}</TableCell>
                    <TableCell className="font-semibold">Inventar #{operation.number}</TableCell>
                    <TableCell align="right" secondary className="tabular-nums">{formatNumber(operation.lines.length)}</TableCell>
                    <TableCell align="right" secondary className="tabular-nums text-[#15803d]">{plus > 0 ? `+${plus}` : "—"}</TableCell>
                    <TableCell align="right" secondary className="tabular-nums text-[#b91c1c]">{minus < 0 ? minus : "—"}</TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{signedNumber(plus + minus)}</TableCell>
                    <TableCell secondary className="text-[#52525b]">
                      {operation.notes?.replace(/^Inventar:?\s*/, "") || "—"}
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex justify-end gap-2">
                        <DocumentDetailsButton details={toDocumentDetails(operation, canModify)} />
                        {canModify ? (
                          <>
                            <a
                              href={`/api/export/inventory/${operation.id}`}
                              className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
                            >
                              <Download className="size-3.5" aria-hidden="true" /> Excel
                            </a>
                            <a
                              href={`/api/export/inventory/${operation.id}?format=pdf`}
                              className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e4e4e7] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
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
                <td className="px-3 py-10 text-center text-[#52525b]" colSpan={8}>
                  Nu există inventare salvate pentru filtrele curente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={(target) => crmInventoryHref({ wh: selected?.id, ...filters, ipage: target })}
        summary={`${start}–${end} din ${formatNumber(total)} inventare`}
      />
    </div>
  );
}

/** Câte rânduri pleacă deodată în „Numără rămasele" — un raft, nu tot depozitul. */
const REMAINING_BATCH = 100;

/**
 * Progresul numărătorii în depozitul ales: ce s-a numărat de la o dată încoace
 * și ce mai are stoc în sistem fără să fi fost numărat. Rămasele se pot
 * deschide direct într-un inventar, gata puse pe rânduri.
 */
function CountProgress({ data, canModify }: { data: InventoryData; canModify: boolean }) {
  const counted = new Set(Object.keys(data.counted));
  const remaining = data.stocks.filter((row) => row.quantity > 0 && !counted.has(row.productId));
  const total = counted.size + remaining.length;
  const percent = total > 0 ? Math.round((counted.size / total) * 100) : 0;
  const [year, month, day] = data.countSince.split("-");
  const prefill: InventoryPrefillItem[] = remaining.slice(0, REMAINING_BATCH).map((row) => ({
    productId: row.productId,
    label: [row.product.externalCode ?? "—", vehicleLabels(row.product), row.product.description]
      .filter(Boolean)
      .join(" · "),
    stockHere: row.quantity,
  }));

  return (
    <section className="grid gap-3 rounded-xl border border-[#e4e4e7] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-semibold text-[#18181b]">
          <span className="grid size-8 place-items-center rounded-lg bg-[#eff6ff] text-[#2563eb]">
            <ClipboardCheck className="size-4" aria-hidden="true" />
          </span>
          Numărătoarea în {data.selected?.name}
          <span className="text-sm font-normal text-[#71717a]">
            de la {day}.{month}.{year}
          </span>
        </h2>
        {canModify && remaining.length > 0 ? (
          <InventoryDialog
            warehouses={data.warehouses.map((w) => ({ id: w.id, name: w.name }))}
            defaultWarehouseId={data.selected?.id}
            alreadyCounted={data.counted}
            prefill={prefill}
            triggerLabel={`Numără rămasele (${prefill.length}${remaining.length > prefill.length ? ` din ${remaining.length}` : ""})`}
          />
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-[#f1f1f3]">
          <div className="h-2 rounded-full bg-[#16a34a]" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-sm text-[#52525b]">
          <span className="font-semibold tabular-nums text-[#166534]">{formatNumber(counted.size)}</span> numărate ·{" "}
          <span className="font-semibold tabular-nums text-[#18181b]">{formatNumber(remaining.length)}</span> rămase cu stoc
          în sistem · <span className="font-semibold tabular-nums text-[#18181b]">{percent}%</span>
        </p>
      </div>

      {remaining.length > 0 ? (
        <details className="group">
          <summary className="inline-flex cursor-pointer list-none text-sm font-medium text-[#2563eb] hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Arată ce a rămas de numărat</span>
            <span className="hidden group-open:inline">Ascunde lista</span>
          </summary>
          <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-[#f0f0f2]">
            <table className="crm-table w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 border-b border-[#e4e4e7] bg-[#fafafa]">
                <tr>
                  <TableHead>Cod</TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead align="right">În sistem</TableHead>
                </tr>
              </thead>
              <tbody>
                {remaining.map((row) => (
                  <tr key={row.id} className="border-t border-[#f0f0f2]">
                    <TableCell className="whitespace-nowrap font-mono font-semibold">{formatText(row.product.externalCode)}</TableCell>
                    <TableCell>
                      {row.product.description}
                      <VehicleSubline product={row.product} />
                    </TableCell>
                    <TableCell align="right" className="font-semibold tabular-nums">{formatNumber(row.quantity)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : total > 0 ? (
        <p className="text-sm font-medium text-[#166534]">Tot ce are stoc în sistem a fost numărat.</p>
      ) : null}
    </section>
  );
}
