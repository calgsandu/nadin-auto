import Link from "next/link";
import { Suspense } from "react";
import {
  getOperationsData,
  getSalesDayData,
  type OperationsData,
  type SalesDayData,
} from "@/lib/operations/queries";
import { StockSaleDialog } from "@/app/operations/stock-document-dialog";
import { canCreateSales, canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { DailyMetric, segmentCls, segmentedCls, WorkspaceSkeleton } from "../_components/ui";
import {
  RecentDocumentsTable,
  SalesRegisterExport,
  documentTotalLei,
} from "../_components/documents-table";
import { toCustomerOptions, toSupplierOptions, toWarehouseOptions } from "../_components/operations-options";
import { formatMoney, formatNumber } from "../_components/format";
import { SalesDayNav } from "../sales-day-nav";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; filtru?: string }>;
}) {
  const appUser = await requireCrmSection("vanzari");
  const { day, filtru } = await searchParams;
  const filter = saleFilters.some((item) => item.id === filtru) ? (filtru as SaleFilterId) : "toate";
  const canModify = canWriteCatalog(appUser.role);
  const canSell = canCreateSales(appUser.role);
  const operationsPromise = getOperationsData("vanzari");
  const salesDayPromise = getSalesDayData(day);

  return (
    <>
      <CrmHeader section="vanzari" role={appUser.role} />
      <Suspense key={`${day ?? "azi"}:${filter}`} fallback={<WorkspaceSkeleton cards={3} rows={5} />}>
        <Loader
          filter={filter}
          operationsPromise={operationsPromise}
          salesDayPromise={salesDayPromise}
          canModify={canModify}
          canSell={canSell}
        />
      </Suspense>
    </>
  );
}

async function Loader({
  filter,
  operationsPromise,
  salesDayPromise,
  canModify,
  canSell,
}: {
  filter: SaleFilterId;
  operationsPromise: Promise<OperationsData>;
  salesDayPromise: Promise<SalesDayData>;
  canModify: boolean;
  canSell: boolean;
}) {
  const [operations, salesDay] = await Promise.all([operationsPromise, salesDayPromise]);
  return (
    <SalesWorkspace
      filter={filter}
      canModify={canModify}
      canSell={canSell}
      operations={operations}
      salesDay={salesDay}
    />
  );
}

const salesDayLabelFormat = new Intl.DateTimeFormat("ro-MD", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const salesMonthLabelFormat = new Intl.DateTimeFormat("ro-MD", {
  month: "long",
  year: "numeric",
});

/**
 * Filtrele rapide de deasupra tabelului: ce rămâne de rezolvat până la
 * închiderea zilei (nebătute la casă, vândute pe datorie).
 */
const saleFilters = [
  { id: "toate", label: "Toate", match: () => true },
  { id: "nebatute", label: "Nebătute la casă", match: (sale: { cashRegistered: boolean | null }) => sale.cashRegistered !== true },
  { id: "datorie", label: "Pe datorie", match: (sale: { paymentMethod: string | null }) => sale.paymentMethod === "CREDIT" },
] as const;
type SaleFilterId = (typeof saleFilters)[number]["id"];

function SalesWorkspace({
  filter,
  canModify,
  canSell,
  operations,
  salesDay,
}: {
  filter: SaleFilterId;
  canModify: boolean;
  canSell: boolean;
  operations: OperationsData;
  salesDay: SalesDayData;
}) {
  const { dayKey, sales, monthCount, monthLei } = salesDay;
  const dayProducts = sales.reduce(
    (total, document) =>
      total + document.lines.reduce((lineTotal, line) => lineTotal + line.quantity, 0),
    0,
  );
  const dayLei = sales.reduce((total, document) => total + documentTotalLei(document), 0);
  const selectedDate = new Date(`${dayKey}T12:00:00`);
  const today = new Date();
  const isToday =
    dayKey ===
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthName = salesMonthLabelFormat.format(selectedDate);
  const activeFilter = saleFilters.find((item) => item.id === filter) ?? saleFilters[0];

  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SalesDayNav dayKey={dayKey} />
        <div className="flex flex-wrap items-center gap-2">
          {canModify ? <SalesRegisterExport /> : null}
          {canSell ? (
            <StockSaleDialog
              openFromUrl
              warehouses={toWarehouseOptions(operations.warehouses)}
              customers={toCustomerOptions(operations.customers)}
              suppliers={toSupplierOptions(operations.suppliers)}
            />
          ) : null}
        </div>
      </div>

      <div className="stat-strip grid grid-cols-2 lg:grid-cols-4">
        <DailyMetric
          label={isToday ? "Vânzări azi" : "Vânzări în ziua aleasă"}
          value={formatNumber(sales.length)}
        />
        <DailyMetric label="Produse vândute" value={formatNumber(dayProducts)} />
        <DailyMetric label="Total zi" value={`${formatMoney(dayLei)} lei`} />
        <DailyMetric
          label={`Total ${monthName}`}
          value={`${formatMoney(monthLei)} lei`}
          hint={`${formatNumber(monthCount)} vânzări în lună`}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold text-[#18181b] first-letter:uppercase">
            {salesDayLabelFormat.format(selectedDate)}
          </h2>
          <div className={segmentedCls}>
          {saleFilters.map((item) => {
            const count = sales.filter((sale) => item.match(sale)).length;
            const active = item.id === filter;
            const query = new URLSearchParams();
            if (dayKey && !isToday) query.set("day", dayKey);
            if (item.id !== "toate") query.set("filtru", item.id);
            const search = query.toString();
            return (
              <Link
                key={item.id}
                aria-current={active ? "true" : undefined}
                href={search ? `/crm/vanzari?${search}` : "/crm/vanzari"}
                className={segmentCls(active)}
              >
                {item.label} <span className="tabular-nums opacity-70">{formatNumber(count)}</span>
              </Link>
            );
          })}
          </div>
        </div>
        <RecentDocumentsTable
          documents={sales.filter((sale) => activeFilter.match(sale))}
          canModify={canModify}
          emptyText={
            filter !== "toate"
              ? "Nicio vânzare pentru filtrul ales."
              : isToday
                ? "Nicio vânzare înregistrată azi."
                : "Nicio vânzare în ziua aleasă."
          }
        />
      </div>
    </section>
  );
}

