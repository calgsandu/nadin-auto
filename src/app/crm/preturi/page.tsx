import { Search } from "lucide-react";
import { Suspense } from "react";
import { getPriceHistoryData, type PriceHistoryData } from "@/lib/reports/prices";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { FilterReset, FilterSubmit, Pagination, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
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
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <form action="/crm/preturi" method="get" className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#71717a]"
            aria-hidden="true"
          />
          <span className="sr-only">Caută produs</span>
          <input
            className="field-control h-9 w-full rounded-lg border border-[#e4e4e7] bg-white pl-8 pr-3 text-sm text-[#18181b] outline-none placeholder:text-[#71717a]"
            type="search"
            name="q"
            defaultValue={data.filters.q}
            placeholder="Caută după cod sau denumire"
          />
        </label>
        <FilterSubmit label="Caută" />
        {data.filters.q ? <FilterReset href="/crm/preturi" /> : null}
      </form>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
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
                <tr key={change.id} className="motion-table-row border-t border-[#f0f0f2] align-top hover:bg-[#fafafa]">
                  <TableCell secondary className="whitespace-nowrap text-xs tabular-nums text-[#52525b]">
                    {dateTimeFormat.format(change.createdAt)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-[#18181b]">{change.description}</p>
                    {change.code ? (
                      <p className="mt-0.5 text-xs tabular-nums text-[#52525b]">{change.code}</p>
                    ) : null}
                  </TableCell>
                  <PriceCell before={change.costBefore} after={change.costAfter} unit="lei" />
                  <PriceCell before={change.saleBefore} after={change.saleAfter} unit="lei" />
                  <PriceCell before={change.euroBefore} after={change.euroAfter} unit="EUR" secondary />
                  <TableCell secondary className="text-[#52525b]">
                    {formatText(change.changedByName)}
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.changes.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#52525b]">
            {data.filters.q
              ? "Niciun produs cu acest nume și-a schimbat prețul."
              : "Nicio schimbare de preț înregistrată încă. Se scriu automat la fiecare editare de produs."}
          </div>
        ) : null}
      </div>

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        hrefFor={(target) => pageHref(data.filters.q, target)}
        summary={`${start}–${end} din ${formatNumber(data.total)} modificări`}
      />
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
      <TableCell align="right" secondary={secondary} className="tabular-nums text-[#a1a1aa]">
        —
      </TableCell>
    );
  }

  const rose = before !== null && after !== null && after > before;
  const fell = before !== null && after !== null && after < before;
  const delta = before !== null && after !== null ? after - before : null;

  return (
    <TableCell align="right" secondary={secondary} className="tabular-nums">
      <span className="text-[#71717a]">
        {before === null ? "—" : formatMoney(before)}
      </span>
      <span className="mx-1 text-[#a1a1aa]">→</span>
      <span
        className={`font-semibold ${rose ? "text-[#b91c1c]" : fell ? "text-[#15803d]" : "text-[#18181b]"}`}
      >
        {after === null ? "—" : formatMoney(after)}
      </span>
      <span className="ml-1 text-xs text-[#71717a]">{unit}</span>
      {delta !== null && before !== null && before !== 0 ? (
        <p className="mt-0.5 text-xs text-[#71717a]">
          {delta > 0 ? "+" : ""}
          {formatMoney(delta)} ({delta > 0 ? "+" : ""}
          {Math.round((delta / before) * 100)}%)
        </p>
      ) : null}
    </TableCell>
  );
}
