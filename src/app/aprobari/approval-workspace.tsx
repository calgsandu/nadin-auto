import Link from "next/link";
import {
  ApproveButton,
  RejectButton,
} from "@/app/aprobari/approval-buttons";
import type { ApprovalsData } from "@/lib/audit/queries";
import { cashRegisterLabel } from "@/lib/operations/cash-register";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";
import { DailyMetric, StatusBadge } from "@/app/crm/_components/ui";

const dateTimeFormat = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const moneyFormat = new Intl.NumberFormat("ro-MD", {
  maximumFractionDigits: 2,
});

type ApprovalItem = ApprovalsData["pending"][number];

export function ApprovalWorkspace({ data }: { data: ApprovalsData }) {
  return (
    <section className="motion-page grid gap-4 p-4">
      <div className="stat-strip grid grid-cols-1 sm:grid-cols-3">
        <DailyMetric label="În așteptare" value={String(data.pending.length)} />
        <DailyMetric label="Respinse recent" value={String(data.rejected.length)} />
        <DailyMetric label="Aprobate recent" value={String(data.approved.length)} />
      </div>

      <ApprovalList
        title="De aprobat"
        entries={data.pending}
        empty="Nu există cereri în așteptare."
        mode="pending"
      />

      {data.rejected.length > 0 ? (
        <ApprovalList
          title="Respinse recent"
          entries={data.rejected}
          empty=""
          mode="rejected"
        />
      ) : null}

      {data.approved.length > 0 ? (
        <ApprovalList
          title="Aprobate recent"
          entries={data.approved}
          empty=""
          mode="approved"
        />
      ) : null}
    </section>
  );
}


function ApprovalList({
  title,
  entries,
  empty,
  mode,
}: {
  title: string;
  entries: ApprovalItem[];
  empty: string;
  mode: "pending" | "rejected" | "approved";
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold text-[#18181b]">{title}</h2>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d8d5ce] bg-white px-5 py-12 text-center text-sm text-[#52525b]">
          {empty}
        </div>
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => (
            <ApprovalCard key={entry.id} entry={entry} mode={mode} />
          ))}
        </div>
      )}
    </section>
  );
}

function ApprovalCard({
  entry,
  mode,
}: {
  entry: ApprovalItem;
  mode: "pending" | "rejected" | "approved";
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#f0f0f2] px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ModeBadge mode={mode} />
            <StatusBadge tone="gray">{entry.kind === "SALE" ? "Vânzare" : "Predare cont"}</StatusBadge>
          </div>
          <h3 className="mt-2 font-semibold text-[#18181b]">{entry.summary}</h3>
          <p className="mt-1 text-xs text-[#71717a]">
            {entry.requestedByName || entry.requestedByEmail || "Utilizator"},{" "}
            {dateTimeFormat.format(entry.createdAt)}
          </p>
        </div>
        {mode === "pending" ? (
          <div className="flex flex-wrap items-start justify-end gap-2">
            <ApproveButton operationId={entry.id} />
            <RejectButton operationId={entry.id} />
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 px-4 py-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Detail label="Locație" value={entry.details.warehouseName} />
          <Detail label="Client" value={entry.details.customerName} />
          <Detail
            label="Total"
            value={`${moneyFormat.format(entry.details.totalLei)} lei`}
          />
          {entry.details.kind === "SALE" ? (
            <>
              <Detail label="Data documentului" value={entry.details.documentDate} />
              <Detail
                label="Casă"
                value={cashRegisterLabel(entry.details.cashRegistered)}
              />
              <Detail
                label="Metoda de plată"
                value={salePaymentMethodLabel(entry.details.paymentMethod)}
              />
            </>
          ) : (
            <Detail
              label="Cont de plată"
              value={
                entry.details.accountNumber
                  ? `#${entry.details.accountNumber}`
                  : "Indisponibil"
              }
            />
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#f0f0f2]">
          <table className="crm-table w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="bg-[#fafafa] text-xs text-[#52525b]">
              <tr>
                <th className="px-3 py-2 font-semibold">Produs</th>
                <th className="px-3 py-2 text-right font-semibold">Cantitate</th>
                <th className="px-3 py-2 text-right font-semibold">Preț</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {entry.details.lines.map((line) => (
                <tr key={line.productId} className="border-t border-[#f0f0f2]">
                  <td className="px-3 py-2.5 font-medium">{line.productLabel}</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {line.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {moneyFormat.format(line.unitPriceLei)} lei
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold">
                    {moneyFormat.format(line.quantity * line.unitPriceLei)} lei
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {entry.lastError ? (
          <p role="alert" className="rounded-lg bg-[#fff1f1] px-3 py-2 text-sm text-[#b42318]">
            Ultima încercare nu a putut fi aplicată: {entry.lastError}
          </p>
        ) : null}

        {mode === "rejected" && entry.reviewNote ? (
          <p className="rounded-lg bg-[#fff1f1] px-3 py-2 text-sm text-[#b42318]">
            Motiv: {entry.reviewNote}
          </p>
        ) : null}

        {mode === "approved" && entry.appliedEntityId ? (
          <div className="flex justify-end">
            <Link
              href={`/crm/istoric?doc=${entry.appliedEntityId}`}
              className="text-sm font-semibold text-[#1d4ed8] underline decoration-[#84adff] underline-offset-4"
            >
              Vezi documentul în istoric
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#71717a]">{label}</p>
      <p className="mt-1 font-medium text-[#18181b]">{value}</p>
    </div>
  );
}

function ModeBadge({ mode }: { mode: "pending" | "rejected" | "approved" }) {
  if (mode === "pending") return <StatusBadge tone="blue">În așteptare</StatusBadge>;
  if (mode === "rejected") return <StatusBadge tone="red">Respinsă</StatusBadge>;
  return <StatusBadge tone="green">Aprobată</StatusBadge>;
}
