import Link from "next/link";
import {
  ApproveButton,
  RejectButton,
} from "@/app/aprobari/approval-buttons";
import type { ApprovalsData } from "@/lib/audit/queries";
import { cashRegisterLabel } from "@/lib/operations/cash-register";
import { salePaymentMethodLabel } from "@/lib/operations/sale-payment-method";

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
    <section className="motion-page grid gap-5 p-4 lg:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="În așteptare" value={data.pending.length} tone="blue" />
        <Metric label="Respinse recent" value={data.rejected.length} tone="red" />
        <Metric label="Aprobate recent" value={data.approved.length} tone="green" />
      </div>

      <ApprovalList
        title="Cereri care așteaptă decizia"
        description="Stocul nu este modificat până când aprobi cererea."
        entries={data.pending}
        empty="Nu există cereri în așteptare."
        mode="pending"
      />

      {data.rejected.length > 0 ? (
        <ApprovalList
          title="Respinse recent"
          description="Aceste cereri nu au produs nicio modificare de stoc."
          entries={data.rejected}
          empty=""
          mode="rejected"
        />
      ) : null}

      {data.approved.length > 0 ? (
        <ApprovalList
          title="Aprobate recent"
          description="Operațiunile de mai jos au fost aplicate tranzacțional."
          entries={data.approved}
          empty=""
          mode="approved"
        />
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "red" | "green";
}) {
  const colors = {
    blue: "bg-[#eef6ff] text-[#175cd3]",
    red: "bg-[#fff1f1] text-[#b42318]",
    green: "bg-[#ecfdf3] text-[#027a48]",
  };
  return (
    <div className={`rounded-xl px-4 py-4 ${colors[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ApprovalList({
  title,
  description,
  entries,
  empty,
  mode,
}: {
  title: string;
  description: string;
  entries: ApprovalItem[];
  empty: string;
  mode: "pending" | "rejected" | "approved";
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold text-[#1b1a17]">{title}</h2>
        <p className="mt-1 text-sm text-[#6f6b63]">{description}</p>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d8d5ce] bg-white px-5 py-12 text-center text-sm text-[#6f6b63]">
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
    <article className="motion-card overflow-hidden rounded-xl border border-[#e3e1dc] bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#efeeeb] px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge mode={mode} />
            <span className="rounded-md bg-[#f1f0ed] px-2 py-1 text-[11px] font-semibold text-[#6f6b63]">
              {entry.kind === "SALE" ? "Vânzare" : "Predare cont"}
            </span>
          </div>
          <h3 className="mt-2 font-semibold text-[#1b1a17]">{entry.summary}</h3>
          <p className="mt-1 text-xs text-[#98948b]">
            {entry.requestedByName || entry.requestedByEmail || "Utilizator"} ·{" "}
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

        <div className="overflow-x-auto rounded-lg border border-[#efeeeb]">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead className="bg-[#fafaf9] text-xs text-[#6f6b63]">
              <tr>
                <th className="px-3 py-2 font-semibold">Produs</th>
                <th className="px-3 py-2 text-right font-semibold">Cantitate</th>
                <th className="px-3 py-2 text-right font-semibold">Preț</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {entry.details.lines.map((line) => (
                <tr key={line.productId} className="border-t border-[#efeeeb]">
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
              href={`/crm?section=istoric&doc=${entry.appliedEntityId}`}
              className="text-sm font-semibold text-[#175cd3] underline decoration-[#84adff] underline-offset-4"
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
      <p className="text-xs font-medium text-[#98948b]">{label}</p>
      <p className="mt-1 font-medium text-[#1b1a17]">{value}</p>
    </div>
  );
}

function StatusBadge({
  mode,
}: {
  mode: "pending" | "rejected" | "approved";
}) {
  const meta = {
    pending: {
      label: "În așteptare",
      className: "bg-[#eef6ff] text-[#175cd3]",
    },
    rejected: {
      label: "Respinsă",
      className: "bg-[#fff1f1] text-[#b42318]",
    },
    approved: {
      label: "Aprobată",
      className: "bg-[#ecfdf3] text-[#027a48]",
    },
  }[mode];
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${meta.className}`}>
      {meta.label}
    </span>
  );
}
