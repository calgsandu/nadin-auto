import { Suspense } from "react";
import { CalendarDays, Download, FileText, Users } from "lucide-react";
import { SalePaymentMethodBadge, SalePaymentMethodControl } from "@/app/operations/sale-payment-method-control";
import { DocumentDetailsButton } from "@/app/operations/document-details";
import { DocumentRowActions } from "@/app/operations/document-row-actions";
import { RowMenu } from "@/app/components/row-menu";
import { getDocumentsData, type DocumentsSearchParams } from "@/lib/documents/queries";
import { crmDocumentsHref, crmSectionHref } from "@/lib/crm/urls";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import {
  FilterField,
  FilterReset,
  FilterSubmit,
  Pagination,
  TableCell,
  TableHead,
  WorkspaceSkeleton,
  adminRowCls,
  filterControlCls,
} from "../_components/ui";
import { toDocLines, toDocumentDetails } from "../_components/documents-table";
import { formatDate, formatDocType, formatMoney, formatNumber } from "../_components/format";
import { MobileFilters } from "../_components/mobile-filters";

type DocumentsData = Awaited<ReturnType<typeof getDocumentsData>>;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<DocumentsSearchParams>;
}) {
  const appUser = await requireCrmSection("documente");
  const params = await searchParams;
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getDocumentsData({
    dtype: params.dtype,
    partner: params.partner,
    from: params.from,
    to: params.to,
    dpage: params.dpage,
  });
  const key = [params.dtype, params.partner, params.from, params.to, params.dpage].join(":");

  return (
    <>
      <CrmHeader section="documente" role={appUser.role} />
      <Suspense key={key} fallback={<WorkspaceSkeleton filters={4} rows={8} />}>
        <Loader dataPromise={dataPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  canModify,
}: {
  dataPromise: Promise<DocumentsData>;
  canModify: boolean;
}) {
  const data = await dataPromise;
  return <DocumentsWorkspace data={data} canModify={canModify} />;
}

function DocumentsWorkspace({ data, canModify }: { data: DocumentsData; canModify: boolean }) {
  const { documents, filters, partners, warehouses, page, pageCount, total, pageSize } = data;
  // Fără asta, editarea unei recepții arăta „Nu există furnizori" cu selectul
  // dezactivat, deși furnizorii existau: prop-ul pur și simplu nu era dat.
  const suppliers = partners.filter((p) => p.kind === "SUPPLIER" || p.kind === "BOTH");
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <form action="/crm/documente" method="get" className="flex flex-wrap items-center gap-2">
        <MobileFilters active={[filters.dtype, filters.partner, filters.from, filters.to].filter(Boolean).length}>
        <FilterField icon={<FileText />} label="Tip" active={Boolean(filters.dtype)}>
          <select className={filterControlCls} name="dtype" defaultValue={filters.dtype}>
            <option value="">Toate tipurile</option>
            <option value="RECEIPT">Recepții</option>
            <option value="SALE">Vânzări</option>
            <option value="RETURN">Retururi</option>
            <option value="ADJUSTMENT">Ajustări/Transferuri</option>
          </select>
        </FilterField>
        <FilterField icon={<Users />} label="Partener" active={Boolean(filters.partner)}>
          <select className={`${filterControlCls} max-w-44`} name="partner" defaultValue={filters.partner}>
            <option value="">Toți partenerii</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField icon={<CalendarDays />} label="De la" active={Boolean(filters.from)}>
          <input className={filterControlCls} type="date" name="from" defaultValue={filters.from} />
        </FilterField>
        <span className="text-[#a1a1aa]" aria-hidden="true">–</span>
        <FilterField icon={<CalendarDays />} label="Până la" active={Boolean(filters.to)}>
          <input className={filterControlCls} type="date" name="to" defaultValue={filters.to} />
        </FilterField>
        <FilterSubmit />
        {filters.dtype || filters.partner || filters.from || filters.to ? (
          <FilterReset href={crmSectionHref("documente")} />
        ) : null}
        </MobileFilters>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full border-collapse text-left text-sm sm:min-w-[820px]">
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
              <tr>
                <TableHead>Document</TableHead>
                <TableHead className="max-sm:hidden">Depozit</TableHead>
                <TableHead className="max-sm:hidden">Partener</TableHead>
                <TableHead align="right" className="max-sm:hidden">Produse</TableHead>
                <TableHead align="right" className="max-sm:hidden">Total</TableHead>
                <TableHead className="max-sm:hidden">Plată</TableHead>
                <TableHead align="right">
                  <span className="sr-only">Acțiuni</span>
                </TableHead>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className={adminRowCls}>
                  <TableCell className="whitespace-nowrap">
                    <span className="block font-semibold">{formatDocType(d.type)} #{d.number}</span>
                    <span className="block text-xs text-[#52525b]">{formatDate(d.documentDate)}</span>
                    {/* Pe telefon: partenerul și totalul sub document, în loc de coloane. */}
                    <span className="mt-1 block whitespace-normal text-xs text-[#52525b] sm:hidden">
                      {[d.partner?.name, documentTotal(d)].filter(Boolean).join(" · ")}
                    </span>
                  </TableCell>
                  <TableCell className="max-sm:hidden">{d.warehouse.name}</TableCell>
                  <TableCell className="max-sm:hidden">{d.partner?.name ?? "—"}</TableCell>
                  <TableCell align="right" className="font-mono max-sm:hidden">{formatNumber(d._count.lines)}</TableCell>
                  <TableCell align="right" className="font-mono max-sm:hidden">
                    {documentTotal(d) ?? "—"}
                  </TableCell>
                  <TableCell className="max-sm:hidden">
                    {d.type === "SALE" ? (
                      canModify ? (
                        <SalePaymentMethodControl documentId={d.id} value={d.paymentMethod} />
                      ) : (
                        <SalePaymentMethodBadge value={d.paymentMethod} />
                      )
                    ) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {/* „Detalii" rămâne la vedere; exporturile, editarea și ștergerea stau în „⋯". */}
                    <div className="flex justify-end gap-1.5">
                      <DocumentDetailsButton details={toDocumentDetails(d, canModify)} />
                      <RowMenu label={`${formatDocType(d.type)} #${d.number}`}>
                        <a href={`/api/export/document/${d.id}/pdf`} className="text-[#18181b]">
                          <FileText className="size-4 text-[#71717a]" aria-hidden="true" /> PDF intern
                        </a>
                        {d.type !== "ADJUSTMENT" ? (
                          <a href={`/api/export/invoice/${d.id}`} className="text-[#18181b]">
                            <Download className="size-4 text-[#71717a]" aria-hidden="true" /> Excel intern
                          </a>
                        ) : null}
                        {canModify ? (
                          <DocumentRowActions
                            id={d.id}
                            title={`${formatDocType(d.type)} #${d.number}`}
                            documentDate={d.documentDate.toISOString().slice(0, 10)}
                            documentType={d.type}
                            notes={d.notes ?? ""}
                            partnerId={d.partner?.id ?? ""}
                            partnerName={d.partner?.name ?? ""}
                            suppliers={suppliers}
                            warehouses={warehouses}
                            warehouseId={d.warehouseId}
                            lines={toDocLines(d)}
                            isTransfer={Boolean(d.transferGroupId)}
                          />
                        ) : null}
                      </RowMenu>
                    </div>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {documents.length === 0 ? <div className="px-4 py-12 text-center text-sm text-[#52525b]">Niciun document pentru filtrele curente.</div> : null}
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        hrefFor={(target) => crmDocumentsHref({ ...filters, dpage: target })}
        summary={`${start}–${end} din ${formatNumber(total)} documente`}
      />
    </section>
  );
}

function documentTotal(d: { totalEuro: Parameters<typeof formatMoney>[0] | null; totalLei: Parameters<typeof formatMoney>[0] | null }) {
  if (d.totalEuro != null) return `${formatMoney(d.totalEuro)} EUR`;
  if (d.totalLei != null) return `${formatMoney(d.totalLei)} lei`;
  return null;
}
