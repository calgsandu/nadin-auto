import { Suspense } from "react";
import Link from "next/link";
import { PartnerFormDialog, type PartnerFormValue } from "@/app/partners/partner-form-dialog";
import { PartnerDeleteButton } from "@/app/partners/partner-delete-button";
import { PartnerPaymentDialog } from "@/app/partners/payment-dialog";
import {
  getCustomerDetail,
  getCustomersData,
  type CustomerDetail,
  type CustomerRow,
  type CustomersData,
} from "@/lib/partners/customers";
import { crmCustomersHref } from "@/lib/crm/urls";
import { productLineLabel } from "@/lib/catalog/product-line-label";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
import { formatDate, formatMoney, formatNumber, formatText } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const appUser = await requireCrmSection("clienti");
  const { client } = await searchParams;
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getCustomersData();
  const detailPromise = client ? getCustomerDetail(client) : null;

  return (
    <>
      <CrmHeader section="clienti" role={appUser.role}>
        {canModify ? (
          <PartnerFormDialog defaultKind="CUSTOMER" triggerLabel="Adaugă client" />
        ) : null}
      </CrmHeader>
      <Suspense fallback={<WorkspaceSkeleton cards={3} rows={8} />}>
        <Loader
          canModify={canModify}
          dataPromise={dataPromise}
          detailPromise={detailPromise}
          openId={client ?? null}
        />
      </Suspense>
    </>
  );
}

async function Loader({
  canModify,
  dataPromise,
  detailPromise,
  openId,
}: {
  canModify: boolean;
  dataPromise: Promise<CustomersData>;
  detailPromise: Promise<CustomerDetail> | null;
  openId: string | null;
}) {
  const [data, detail] = await Promise.all([dataPromise, detailPromise]);
  const open = openId ? data.customers.find((one) => one.id === openId) ?? null : null;

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <DailyMetric label="Clienți" value={formatNumber(data.customers.length)} />
        <DailyMetric
          label="Cumpărat total"
          value={`${formatMoney(sum(data.customers, (one) => one.boughtLei))} lei`}
        />
        <DailyMetric
          label="Datorii deschise"
          value={`${formatMoney(sum(data.customers, (one) => Math.max(one.debtLei, 0)))} lei`}
        />
      </div>

      {open && detail ? (
        <CustomerCard canModify={canModify} customer={open} detail={detail} />
      ) : null}

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Client</TableHead>
                <TableHead secondary>Contact</TableHead>
                <TableHead align="right" secondary>Discount</TableHead>
                <TableHead align="right">Cumpărat</TableHead>
                <TableHead align="right" secondary>Plătit</TableHead>
                <TableHead align="right">Datorie</TableHead>
                <TableHead secondary>Ultima vânzare</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {data.customers.map((customer) => (
                <tr
                  key={customer.id}
                  className={`motion-table-row border-t border-[#efeeeb] align-top hover:bg-[#f6f6f4] ${
                    customer.id === openId ? "bg-[#f6f6f4]" : ""
                  }`}
                >
                  <TableCell className="font-semibold text-[#1b1a17]">
                    <Link
                      className="hover:underline"
                      href={crmCustomersHref(customer.id === openId ? undefined : customer.id)}
                      scroll={false}
                    >
                      {customer.name}
                    </Link>
                    <span className="mt-0.5 block text-xs font-normal text-[#6f6b63]">
                      {formatNumber(customer.purchases)} vânzări
                    </span>
                  </TableCell>
                  <TableCell secondary className="text-[#6f6b63]">
                    <span className="block">{formatText(customer.phone)}</span>
                    {customer.email ? <span className="mt-0.5 block">{customer.email}</span> : null}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
                    {customer.discountPercent ? `${customer.discountPercent}%` : "-"}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums font-semibold text-[#1b1a17]">
                    {formatMoney(customer.boughtLei)}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
                    {formatMoney(customer.paidLei)}
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={`tabular-nums font-semibold ${
                        customer.debtLei > 0 ? "text-[#b91c1c]" : "text-[#6f6b63]"
                      }`}
                    >
                      {customer.debtLei !== 0 ? formatMoney(customer.debtLei) : "-"}
                    </span>
                  </TableCell>
                  <TableCell secondary className="text-[#6f6b63]">
                    {customer.lastPurchaseAt ? formatDate(customer.lastPurchaseAt) : "-"}
                  </TableCell>
                  {canModify ? (
                    <TableCell align="right">
                      <div className="flex justify-end gap-2">
                        <PartnerPaymentDialog
                          partnerId={customer.id}
                          partnerName={customer.name}
                          balanceLei={customer.debtLei}
                        />
                        <PartnerFormDialog
                          partner={toPartnerFormValue(customer)}
                          triggerKind="row"
                          triggerLabel="Editează"
                        />
                        <PartnerDeleteButton
                          partnerId={customer.id}
                          partnerName={customer.name}
                        />
                      </div>
                    </TableCell>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.customers.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">
            Niciun client încă. Clienții adăugați la o vânzare apar aici.
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Fișa clientului deschis: totalurile lui, vânzările linie cu linie, încasările. */
function CustomerCard({
  canModify,
  customer,
  detail,
}: {
  canModify: boolean;
  customer: CustomerRow;
  detail: CustomerDetail;
}) {
  return (
    <div className="motion-card rounded-xl border border-[#e8e7e3] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8e7e3] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-[#1b1a17]">{customer.name}</h2>
          <p className="mt-0.5 text-xs text-[#6f6b63]">
            {formatText(customer.phone)}
            {customer.discountPercent ? ` · discount ${customer.discountPercent}%` : ""}
            {customer.debtLei > 0 ? ` · datorie ${formatMoney(customer.debtLei)} lei` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canModify ? (
            <PartnerFormDialog
              partner={toPartnerFormValue(customer)}
              triggerKind="row"
              triggerLabel="Editează fișa"
            />
          ) : null}
          <Link
            className="button-secondary rounded-md border border-[#e8e7e3] px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
            href={crmCustomersHref()}
            scroll={false}
          >
            Închide
          </Link>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-[#1b1a17]">Ce a cumpărat</h3>
          {detail.sales.length === 0 ? (
            <p className="mt-2 text-sm text-[#6f6b63]">Nicio vânzare înregistrată.</p>
          ) : (
            <ul className="mt-2 grid gap-3">
              {detail.sales.map((sale) => (
                <li key={sale.id} className="border-t border-[#efeeeb] pt-3 first:border-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-[#1b1a17]">
                      Vânzare #{sale.number}
                    </span>
                    <span className="tabular-nums font-semibold text-[#1b1a17]">
                      {formatMoney(sale.totalLei)} lei
                    </span>
                  </div>
                  <p className="text-xs text-[#6f6b63]">
                    {formatDate(sale.documentDate)} · {salePaymentMethodLabel(sale.paymentMethod)}
                    {sale.discountPercent ? ` · -${Number(sale.discountPercent)}%` : ""}
                  </p>
                  <ul className="mt-1 grid gap-0.5 text-xs text-[#6f6b63]">
                    {sale.lines.map((line) => (
                      <li key={line.id} className="flex justify-between gap-3">
                        <span>
                          {line.product
                            ? productLineLabel(line.product)
                            : line.externalName ?? "Piesă externă"}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatNumber(line.quantity)} × {formatMoney(line.unitPriceEuro)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[#1b1a17]">Încasări</h3>
          {detail.payments.length === 0 ? (
            <p className="mt-2 text-sm text-[#6f6b63]">Nicio încasare scrisă.</p>
          ) : (
            <ul className="mt-2 grid gap-2 text-sm">
              {detail.payments.map((payment) => (
                <li key={payment.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-[#6f6b63]">
                    {formatDate(payment.paidAt)}
                    {payment.notes ? (
                      <span className="block text-xs">{payment.notes}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums font-semibold text-[#1b1a17]">
                    {formatMoney(payment.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function sum<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((total, item) => total + pick(item), 0);
}

function toPartnerFormValue(customer: CustomerRow): PartnerFormValue {
  return {
    id: customer.id,
    name: customer.name,
    kind: customer.kind,
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    idno: customer.idno ?? "",
    vatCode: customer.vatCode ?? "",
    iban: customer.iban ?? "",
    bankName: customer.bankName ?? "",
    bankCode: customer.bankCode ?? "",
    notes: customer.notes ?? "",
    discountPercent:
      customer.discountPercent === null ? "" : String(customer.discountPercent),
  };
}
