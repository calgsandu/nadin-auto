import { Suspense } from "react";
import Link from "next/link";
import { Banknote, CalendarDays, Landmark, Wallet } from "lucide-react";
import { getCashRegisterData, type CashRegisterData } from "@/lib/finance/balances";
import { crmCashHref } from "@/lib/crm/urls";
import { MovementDialog } from "@/app/money/movement-dialog";
import { AccountDialog } from "@/app/money/account-dialog";
import { MovementDeleteButton } from "@/app/money/movement-delete-button";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import {
  DailyMetric,
  FilterField,
  FilterSubmit,
  TableCell,
  TableHead,
  WorkspaceSkeleton,
  filterControlCls,
  segmentCls,
  segmentedCls,
} from "../_components/ui";
import { formatDate, formatMoney } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SearchParams = { acc?: string; from?: string; to?: string };

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const appUser = await requireCrmSection("casa");
  const params = await searchParams;
  const dataPromise = getCashRegisterData(params);

  return (
    <>
      <CrmHeader section="casa" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={3} rows={12} />}>
        <Loader dataPromise={dataPromise} />
      </Suspense>
    </>
  );
}

async function Loader({ dataPromise }: { dataPromise: Promise<CashRegisterData> }) {
  return <CashWorkspace data={await dataPromise} />;
}

function CashWorkspace({ data }: { data: CashRegisterData }) {
  const { account, accounts } = data;

  if (!account) {
    return (
      <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
        <div className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-10 text-center text-sm text-[#52525b]">
          Nu există niciun cont de bani. Adaugă casa și contul bancar ca să poți urmări soldul.
        </div>
        <div className="flex justify-center">
          <AccountDialog />
        </div>
      </section>
    );
  }

  const totalCash = accounts
    .filter((one) => one.kind === "CASH")
    .reduce((sum, one) => sum + one.balanceLei, 0);
  const totalBank = accounts
    .filter((one) => one.kind === "BANK")
    .reduce((sum, one) => sum + one.balanceLei, 0);

  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="stat-strip grid grid-cols-3">
        <DailyMetric icon={Banknote} label="În casă" value={`${formatMoney(totalCash)} lei`} />
        <DailyMetric icon={Landmark} label="În bancă" value={`${formatMoney(totalBank)} lei`} />
        <DailyMetric icon={Wallet} label="Total" value={`${formatMoney(totalCash + totalBank)} lei`} />
      </div>

      {/* Contul, intervalul și acțiunile pe un singur rând. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className={segmentedCls}>
          {accounts.map((one) => (
            <Link
              key={one.id}
              href={crmCashHref({ acc: one.id, from: data.from ? toDateInput(data.from) : undefined })}
              aria-current={one.id === account.id ? "page" : undefined}
              className={segmentCls(one.id === account.id)}
            >
              {one.name}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-center gap-2">
          <input name="acc" type="hidden" value={account.id} />
          <FilterField icon={<CalendarDays />} label="De la">
            <input
              className={filterControlCls}
              defaultValue={data.from ? toDateInput(data.from) : ""}
              name="from"
              type="date"
            />
          </FilterField>
          <FilterField icon={<CalendarDays />} label="Până la">
            <input
              className={filterControlCls}
              defaultValue={data.to ? toDateInput(previousDay(data.to)) : ""}
              name="to"
              type="date"
            />
          </FilterField>
          <FilterSubmit />
        </form>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <AccountDialog
            account={{
              id: account.id,
              name: account.name,
              kind: account.kind,
              openingBalanceLei: account.openingBalanceLei,
              openingDate: toDateInput(account.openingDate),
              iban: account.iban ?? "",
            }}
          />
          <MovementDialog accounts={accounts} defaultAccountId={account.id} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e7] px-4 py-3">
          <h2 className="font-semibold text-[#18181b]">{account.name}</h2>
          <p className="text-[13px] text-[#52525b]">
            Sold la început {formatMoney(data.openingLei)} lei, la sfârșit{" "}
            <span className="font-semibold text-[#18181b]">{formatMoney(data.closingLei)} lei</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
              <tr>
                <TableHead>Data</TableHead>
                <TableHead>Mișcare</TableHead>
                <TableHead secondary>Fel</TableHead>
                <TableHead align="right">Sumă</TableHead>
                <TableHead align="right">Sold</TableHead>
                <TableHead align="right" secondary>Acțiuni</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.entries.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-[#52525b]" colSpan={6}>
                    Nicio mișcare în intervalul ales.
                  </td>
                </tr>
              ) : (
                data.entries.map((entry) => (
                  <tr
                    key={`${entry.kind}-${entry.id}`}
                    className="motion-table-row border-t border-[#f0f0f2] hover:bg-[#f4f4f5]"
                  >
                    <TableCell className="tabular-nums">{formatDate(entry.date)}</TableCell>
                    <TableCell className="font-medium">{entry.label}</TableCell>
                    <TableCell secondary className="text-[#52525b]">
                      {entryKindLabel(entry.kind)}
                    </TableCell>
                    <TableCell
                      align="right"
                      className={`font-semibold tabular-nums ${
                        entry.amountLei < 0 ? "text-[#b91c1c]" : "text-[#15803d]"
                      }`}
                    >
                      {entry.amountLei > 0 ? "+" : ""}
                      {formatMoney(entry.amountLei)}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatMoney(entry.balanceLei)}
                    </TableCell>
                    <TableCell align="right" secondary>
                      {entry.kind === "MOVEMENT" ? (
                        <MovementDeleteButton movementId={entry.id} label={entry.label} />
                      ) : null}
                    </TableCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function entryKindLabel(kind: CashRegisterData["entries"][number]["kind"]) {
  if (kind === "SALE") return "Vânzare";
  if (kind === "RETURN") return "Retur";
  if (kind === "PAYMENT_IN") return "Încasare";
  if (kind === "PAYMENT_OUT") return "Plată";
  if (kind === "EXPENSE") return "Cheltuială";
  return "Mișcare de casă";
}

/** Capătul intervalului e exclusiv; în filtru se arată ultima zi cuprinsă. */
function previousDay(date: Date) {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

function toDateInput(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
