import { Suspense } from "react";
import { ShoppingBag, Users, Wallet, X } from "lucide-react";
import Link from "next/link";
import { PartnerFormDialog, type PartnerFormValue } from "@/app/partners/partner-form-dialog";
import { PartnerDeleteButton } from "@/app/partners/partner-delete-button";
import { RowMenu } from "@/app/components/row-menu";
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
import { HeroPanel, PastelCard, StatusBadge, TableCell, TableHead, WorkspaceSkeleton, type PastelTone } from "../_components/ui";
import { formatDate, formatMoney, formatNumber, formatText } from "../_components/format";
import { IconLabel, rowIconButtonCls } from "@/app/components/icon-buttons";

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
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <ClientsOverview customers={data.customers} />

      {open && detail ? (
        <CustomerCard canModify={canModify} customer={open} detail={detail} />
      ) : null}

      <div className="overflow-hidden crm-card">
        <div className="overflow-x-auto">
          <table className="crm-table w-full border-collapse text-left text-sm sm:min-w-[820px]">
            <thead className="border-b border-[#e6e4df] bg-[#faf9f7]">
              <tr>
                <TableHead>Client</TableHead>
                <TableHead secondary>Contact</TableHead>
                <TableHead align="right" secondary>Discount</TableHead>
                <TableHead align="right" className="max-sm:hidden">Cumpărat</TableHead>
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
                  className={`motion-table-row border-t border-[#eeede9] align-top hover:bg-[#faf9f7] ${
                    customer.id === openId ? "bg-[#f3f2ef]" : ""
                  }`}
                >
                  <TableCell className="font-semibold text-[#1a1917]">
                    <Link
                      className="hover:underline"
                      href={crmCustomersHref(customer.id === openId ? undefined : customer.id)}
                      scroll={false}
                    >
                      {customer.name}
                    </Link>
                    <span className="mt-0.5 block text-xs font-normal text-[#57534e]">
                      {formatNumber(customer.purchases)} vânzări
                      <span className="sm:hidden">, {formatMoney(customer.boughtLei)} lei</span>
                    </span>
                  </TableCell>
                  <TableCell secondary className="text-[#57534e]">
                    <span className="block">{formatText(customer.phone)}</span>
                    {customer.email ? <span className="mt-0.5 block">{customer.email}</span> : null}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#57534e]">
                    {customer.discountPercent ? `${customer.discountPercent}%` : "-"}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums font-semibold text-[#1a1917] max-sm:hidden">
                    {formatMoney(customer.boughtLei)}
                  </TableCell>
                  <TableCell align="right" secondary className="tabular-nums text-[#57534e]">
                    {formatMoney(customer.paidLei)}
                  </TableCell>
                  <TableCell align="right">
                    {customer.debtLei > 0 ? (
                      <StatusBadge tone="red">{formatMoney(customer.debtLei)} lei</StatusBadge>
                    ) : (
                      <span className="tabular-nums text-[#57534e]">{customer.debtLei !== 0 ? formatMoney(customer.debtLei) : "-"}</span>
                    )}
                  </TableCell>
                  <TableCell secondary className="text-[#57534e]">
                    {customer.lastPurchaseAt ? formatDate(customer.lastPurchaseAt) : "-"}
                  </TableCell>
                  {canModify ? (
                    <TableCell align="right">
                      <div className="flex justify-end gap-1.5">
                        <PartnerPaymentDialog
                          partnerId={customer.id}
                          partnerName={customer.name}
                          balanceLei={customer.debtLei}
                        />
                        <RowMenu label={customer.name}>
                          <PartnerFormDialog
                            partner={toPartnerFormValue(customer)}
                            triggerKind="row"
                            triggerLabel="Editează"
                          />
                          <PartnerDeleteButton
                            partnerId={customer.id}
                            partnerName={customer.name}
                          />
                        </RowMenu>
                      </div>
                    </TableCell>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.customers.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#57534e]">
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
    <div className="motion-card crm-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e6e4df] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-[#1a1917]">{customer.name}</h2>
          <p className="mt-0.5 text-xs text-[#57534e]">
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
            className={rowIconButtonCls}
            href={crmCustomersHref()}
            scroll={false}
            title="Închide"
          >
            <X aria-hidden="true" />
            <IconLabel>Închide</IconLabel>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-[#1a1917]">Ce a cumpărat</h3>
          {detail.sales.length === 0 ? (
            <p className="mt-2 text-sm text-[#57534e]">Nicio vânzare înregistrată.</p>
          ) : (
            <ul className="mt-2 grid gap-3">
              {detail.sales.map((sale) => (
                <li key={sale.id} className="border-t border-[#eeede9] pt-3 first:border-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-[#1a1917]">
                      Vânzare #{sale.number}
                    </span>
                    <span className="tabular-nums font-semibold text-[#1a1917]">
                      {formatMoney(sale.totalLei)} lei
                    </span>
                  </div>
                  <p className="text-xs text-[#57534e]">
                    {formatDate(sale.documentDate)} · {salePaymentMethodLabel(sale.paymentMethod)}
                    {sale.discountPercent ? ` · -${Number(sale.discountPercent)}%` : ""}
                  </p>
                  <ul className="mt-1 grid gap-0.5 text-xs text-[#57534e]">
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
          <h3 className="text-sm font-semibold text-[#1a1917]">Încasări</h3>
          {detail.payments.length === 0 ? (
            <p className="mt-2 text-sm text-[#57534e]">Nicio încasare scrisă.</p>
          ) : (
            <ul className="mt-2 grid gap-2 text-sm">
              {detail.payments.map((payment) => (
                <li key={payment.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-[#57534e]">
                    {formatDate(payment.paidAt)}
                    {payment.notes ? (
                      <span className="block text-xs">{payment.notes}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums font-semibold text-[#1a1917]">
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

const cardTones: PastelTone[] = ["green", "blue", "lilac", "yellow"];

/**
 * Sus: cât e de încasat și de la cine (blocul negru), apoi cei mai mari patru
 * clienți ca fișe colorate, cu partea lor din tot ce s-a vândut pe clienți.
 */
function ClientsOverview({ customers }: { customers: CustomerRow[] }) {
  const debtors = customers.filter((one) => one.debtLei > 0).sort((a, b) => b.debtLei - a.debtLei);
  const totalDebt = sum(debtors, (one) => one.debtLei);
  const totalBought = sum(customers, (one) => one.boughtLei);
  const top = [...customers].filter((one) => one.boughtLei > 0).sort((a, b) => b.boughtLei - a.boughtLei).slice(0, 4);
  const restDebt = sum(debtors.slice(3), (one) => one.debtLei);
  const segmentTones: PastelTone[] = ["red", "yellow", "blue"];

  return (
    <>
      <HeroPanel
        label="De încasat de la clienți"
        value={`${formatMoney(totalDebt)} lei`}
        note={debtors.length > 0 ? `de la ${formatNumber(debtors.length)} ${debtors.length === 1 ? "client" : "clienți"}` : "nimeni nu datorează"}
        segments={[
          ...debtors.slice(0, 3).map((one, index) => ({
            label: one.name,
            value: `${formatMoney(one.debtLei)} lei`,
            amount: one.debtLei,
            tone: segmentTones[index],
          })),
          ...(restDebt > 0
            ? [{ label: "Alții", value: `${formatMoney(restDebt)} lei`, amount: restDebt, tone: "gray" as const }]
            : []),
        ]}
        stats={[
          { label: "Clienți", value: formatNumber(customers.length), icon: Users, tone: "blue" },
          { label: "Cumpărat total", value: `${formatMoney(totalBought)} lei`, icon: ShoppingBag, tone: "green" },
          { label: "Plătit total", value: `${formatMoney(sum(customers, (one) => one.paidLei))} lei`, icon: Wallet, tone: "lilac" },
        ]}
      />
      {top.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {top.map((customer, index) => (
            <Link key={customer.id} href={crmCustomersHref(customer.id)} scroll={false} className="rounded-[1.25rem] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]">
              <PastelCard
                tone={cardTones[index]}
                title={customer.name}
                subtitle={`${formatNumber(customer.purchases)} vânzări`}
                value={`${formatMoney(customer.boughtLei)} lei`}
                progress={totalBought > 0 ? customer.boughtLei / totalBought : 0}
                footer={
                  <span className="flex items-center justify-between gap-2">
                    <span>{totalBought > 0 ? Math.round((customer.boughtLei / totalBought) * 100) : 0}% din vânzările pe clienți</span>
                    {customer.debtLei > 0 ? (
                      <StatusBadge tone="red">datorează {formatMoney(customer.debtLei)}</StatusBadge>
                    ) : (
                      <StatusBadge tone="green">la zi</StatusBadge>
                    )}
                  </span>
                }
              />
            </Link>
          ))}
        </div>
      ) : null}
    </>
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
