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
import { DailyMetric, WorkspaceSkeleton } from "../_components/ui";
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
  searchParams: Promise<{ day?: string }>;
}) {
  const appUser = await requireCrmSection("vanzari");
  const { day } = await searchParams;
  const canModify = canWriteCatalog(appUser.role);
  const canSell = canCreateSales(appUser.role);
  const operationsPromise = getOperationsData("vanzari");
  const salesDayPromise = getSalesDayData(day);

  return (
    <>
      <CrmHeader section="vanzari" role={appUser.role} />
      <Suspense key={day ?? "azi"} fallback={<WorkspaceSkeleton cards={3} rows={5} />}>
        <Loader
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
  operationsPromise,
  salesDayPromise,
  canModify,
  canSell,
}: {
  operationsPromise: Promise<OperationsData>;
  salesDayPromise: Promise<SalesDayData>;
  canModify: boolean;
  canSell: boolean;
}) {
  const [operations, salesDay] = await Promise.all([operationsPromise, salesDayPromise]);
  return (
    <SalesWorkspace
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

function SalesWorkspace({
  canModify,
  canSell,
  operations,
  salesDay,
}: {
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

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SalesDayNav dayKey={dayKey} />
        <div className="flex flex-wrap items-center gap-2">
          {canModify ? <SalesRegisterExport /> : null}
          {canSell ? (
            <StockSaleDialog
              warehouses={toWarehouseOptions(operations.warehouses)}
              customers={toCustomerOptions(operations.customers)}
              suppliers={toSupplierOptions(operations.suppliers)}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-3">
        <h2 className="font-semibold capitalize text-[#1b1a17]">
          {salesDayLabelFormat.format(selectedDate)}
        </h2>
        <RecentDocumentsTable
          documents={sales}
          canModify={canModify}
          emptyText={isToday ? "Nicio vânzare înregistrată azi." : "Nicio vânzare în ziua aleasă."}
        />
      </div>
    </section>
  );
}

