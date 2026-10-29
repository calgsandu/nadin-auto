import Link from "next/link";
import { Suspense } from "react";
import { Download, FileText } from "lucide-react";
import { CashRegisterBadge, CashRegisterControl } from "@/app/operations/cash-register-control";
import { SalePaymentMethodBadge, SalePaymentMethodControl } from "@/app/operations/sale-payment-method-control";
import { DocumentDetailsButton } from "@/app/operations/document-details";
import { DocumentRowActions } from "@/app/operations/document-row-actions";
import { RowMenu } from "@/app/components/row-menu";
import { getDocumentsData, type DocumentsSearchParams } from "@/lib/documents/queries";
import { crmDocumentsHref, crmSectionHref } from "@/lib/crm/urls";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { PagerLink, TableCell, TableHead, WorkspaceSkeleton, adminRowCls } from "../_components/ui";
import { toDocLines, toDocumentDetails } from "../_components/documents-table";
import { formatDate, formatDocType, formatMoney, formatNumber } from "../_components/format";

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
  const filterInputCls =
    "h-9 rounded-md border border-[#e4e4e7] bg-white px-2.5 text-sm text-[#18181b]";
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section className="motion-page grid gap-3 p-4">
      <form
        action="/crm/documente"
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border border-[#e4e4e7] bg-white px-3 py-3"
      >
        <label className="grid gap-1 text-xs font-semibold text-[#52525b]">
          Tip
          <select className={filterInputCls} name="dtype" defaultValue={filters.dtype}>
            <option value="">Toate</option>
            <option value="RECEIPT">Recepții</option>
            <option value="SALE">Vânzări</option>
            <option value="RETURN">Retururi</option>
            <option value="ADJUSTMENT">Ajustări/Transferuri</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#52525b]">
          Partener
          <select className={filterInputCls} name="partner" defaultValue={filters.partner}>
            <option value="">Toți</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#52525b]">
          De la
          <input className={filterInputCls} type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#52525b]">
          Până la
          <input className={filterInputCls} type="date" name="to" defaultValue={filters.to} />
        </label>
        <button
          type="submit"
          className="button-primary h-9 rounded-md bg-[#2563eb] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
        >
          Filtrează
        </button>
        <Link
          href={crmSectionHref("documente")}
          className="h-9 content-center px-2 text-sm font-medium text-[#18181b] underline decoration-[#2563eb] underline-offset-4"
        >
          Resetează
        </Link>
        <span className="ml-auto text-sm text-[#52525b]">
          {start}-{end} din {formatNumber(total)} documente
        </span>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full border-collapse text-left text-sm" style={{ minWidth: "820px" }}>
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
              <tr>
                <TableHead>Document</TableHead>
                <TableHead>Depozit</TableHead>
                <TableHead>Partener</TableHead>
                <TableHead align="right">Produse</TableHead>
                <TableHead align="right">Total</TableHead>
                <TableHead>Casă</TableHead>
                <TableHead>Plată</TableHead>
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
                  </TableCell>
                  <TableCell>{d.warehouse.name}</TableCell>
                  <TableCell>{d.partner?.name ?? "—"}</TableCell>
                  <TableCell align="right" className="font-mono">{formatNumber(d._count.lines)}</TableCell>
                  <TableCell align="right" className="font-mono">
                    {d.totalEuro != null ? `${formatMoney(d.totalEuro)} EUR` : d.totalLei != null ? `${formatMoney(d.totalLei)} lei` : "—"}
                  </TableCell>
                  <TableCell>
                    {d.type === "SALE" ? (
                      canModify ? (
                        <CashRegisterControl documentId={d.id} value={d.cashRegistered} />
                      ) : (
                        <CashRegisterBadge value={d.cashRegistered} />
                      )
                    ) : "—"}
                  </TableCell>
                  <TableCell>
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

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-[#52525b]">
            Pagina {page} din {pageCount}
          </p>
          <div className="flex gap-2">
            <PagerLink
              disabled={page <= 1}
              href={crmDocumentsHref({ ...filters, dpage: page - 1 })}
              label="Înapoi"
            />
            <PagerLink
              disabled={page >= pageCount}
              href={crmDocumentsHref({ ...filters, dpage: page + 1 })}
              label="Înainte"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

