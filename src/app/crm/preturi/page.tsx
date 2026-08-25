import Link from "next/link";
import { Suspense } from "react";
import { getPriceHistoryData, type PriceHistoryData } from "@/lib/reports/prices";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { PagerLink, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
import { dateTimeFormat, formatMoney, formatNumber, formatText } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PriceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const appUser = await requireCrmSection("preturi");
  const params = await searchParams;
  const dataPromise = getPriceHistoryData(params);

  return (
    <>
      <CrmHeader section="preturi" role={appUser.role} />
      <Suspense
        key={`${params.q ?? ""}:${params.page ?? ""}`}
        fallback={<WorkspaceSkeleton filters={1} rows={10} />}
      >
        <Loader dataPromise={dataPromise} />
      </Suspense>
    </>
  );
}

async function Loader({ dataPromise }: { dataPromise: Promise<PriceHistoryData> }) {
  const data = await dataPromise;
  return <PriceHistoryWorkspace data={data} />;
}

function pageHref(q: string, page: number) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/crm/preturi?${search}` : "/crm/preturi";
}

function PriceHistoryWorkspace({ data }: { data: PriceHistoryData }) {
  const start = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const end = Math.min(data.page * data.pageSize, data.total);

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <form
        action="/crm/preturi"
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border border-[#e8e7e3] bg-white px-3 py-3"
      >
        <label className="grid gap-1 text-xs font-semibold text-[#6f6b63]">
          Caută produs
          <input
            className="h-10 w-64 max-w-full rounded-md border border-[#e8e7e3] bg-white px-2.5 text-sm text-[#1b1a17]"
            type="search"
            name="q"
            defaultValue={data.filters.q}
            placeholder="cod sau denumire"
          />
        </label>
        <button
          type="submit"
          className="button-primary h-10 rounded-md bg-[#1b1a17] px-4 text-sm font-semibold text-white hover:bg-[#33312c]"
        >
          Caută
        </button>
        {data.filters.q ? (
          <Link
            href="/crm/preturi"
            className="h-10 content-center px-2 text-sm font-medium text-[#1b1a17] underline decoration-[#2e90fa] underline-offset-4"
          >
            Resetează
          </Link>
        ) : null}
        <span className="ml-auto text-sm text-[#6f6b63]">
          {start}-{end} din {formatNumber(data.total)} modificări
        </span>
      </form>

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead secondary>Când</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Cost aducere</TableHead>
                <TableHead align="right">Preț vânzare</TableHead>
                <TableHead align="right" secondary>Preț EUR</TableHead>
                <TableHead secondary>Cine</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.changes.map((change) => (
                <tr key={change.id} className="motion-table-row border-t border-[#efeeeb] align-top hover:bg-[#f6f6f4]">
                  <TableCell secondary className="whitespace-nowrap text-xs tabular-nums text-[#6f6b63]">
                    {dateTimeFormat.format(change.createdAt)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-[#1b1a17]">{change.description}</p>
                    {change.code ? (
                      <p className="mt-0.5 text-xs tabular-nums text-[#6f6b63]">{change.code}</p>
                    ) : null}
                  </TableCell>
                  <PriceCell before={change.costBefore} after={change.costAfter} unit="lei" />
                  <PriceCell before={change.saleBefore} after={change.saleAfter} unit="lei" />
                  <PriceCell before={change.euroBefore} after={change.euroAfter} unit="EUR" secondary />
                  <TableCell secondary className="text-[#6f6b63]">
                    {formatText(change.changedByName)}
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.changes.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">
            {data.filters.q
              ? "Niciun produs cu acest nume și-a schimbat prețul."
              : "Nicio schimbare de preț înregistrată încă. Se scriu automat la fiecare editare de produs."}
          </div>
        ) : null}
      </div>

      {data.pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-[#6f6b63]">
            Pagina {data.page} din {data.pageCount}
          </p>
          <div className="flex gap-2">
            <PagerLink
              disabled={data.page <= 1}
              href={pageHref(data.filters.q, data.page - 1)}
              label="Înapoi"
            />
            <PagerLink
              disabled={data.page >= data.pageCount}
              href={pageHref(data.filters.q, data.page + 1)}
              label="Înainte"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** „vechi → nou", cu săgeata colorată după direcția schimbării. */
function PriceCell({
  before,
  after,
  unit,
  secondary = false,
}: {
  before: number | null;
  after: number | null;
  unit: string;
  secondary?: boolean;
}) {
  if (before === after) {
    return (
      <TableCell align="right" secondary={secondary} className="tabular-nums text-[#c6c3bc]">
        —
      </TableCell>
    );
  }

  const rose = before !== null && after !== null && after > before;
  const fell = before !== null && after !== null && after < before;
  const delta = before !== null && after !== null ? after - before : null;

  return (
    <TableCell align="right" secondary={secondary} className="tabular-nums">
      <span className="text-[#98948b]">
        {before === null ? "—" : formatMoney(before)}
      </span>
      <span className="mx-1 text-[#c6c3bc]">→</span>
      <span
        className={`font-semibold ${rose ? "text-[#b91c1c]" : fell ? "text-[#15803d]" : "text-[#1b1a17]"}`}
      >
        {after === null ? "—" : formatMoney(after)}
      </span>
      <span className="ml-1 text-xs text-[#98948b]">{unit}</span>
      {delta !== null && before !== null && before !== 0 ? (
        <p className="mt-0.5 text-xs text-[#98948b]">
          {delta > 0 ? "+" : ""}
          {formatMoney(delta)} ({delta > 0 ? "+" : ""}
          {Math.round((delta / before) * 100)}%)
        </p>
      ) : null}
    </TableCell>
  );
}
