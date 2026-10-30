import Link from "next/link";
import { Suspense } from "react";
import { RestoreButton } from "@/app/istoric/restore-button";
import { AuditDetails } from "@/app/istoric/audit-details";
import { getAuditData, type AuditData, type AuditRow } from "@/lib/audit/queries";
import { crmAuditHref, crmSectionHref } from "@/lib/crm/urls";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { FilterReset, StatusBadge, TableCell, TableHead, WorkspaceSkeleton, type BadgeTone } from "../_components/ui";
import { dateTimeFormat } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; act?: string }>;
}) {
  const appUser = await requireCrmSection("istoric");
  const params = await searchParams;
  const dataPromise = getAuditData({ doc: params.doc, act: params.act });

  return (
    <>
      <CrmHeader section="istoric" role={appUser.role} />
      <Suspense key={`${params.doc ?? ""}:${params.act ?? ""}`} fallback={<WorkspaceSkeleton rows={8} />}>
        <Loader dataPromise={dataPromise} />
      </Suspense>
    </>
  );
}

async function Loader({ dataPromise }: { dataPromise: Promise<AuditData> }) {
  const data = await dataPromise;
  return <AuditWorkspace data={data} />;
}

const AUDIT_ACTION_META: Record<string, { label: string; tone: BadgeTone }> = {
  CREATE: { label: "Creare", tone: "green" },
  UPDATE: { label: "Editare", tone: "blue" },
  DELETE: { label: "Ștergere", tone: "red" },
};

const AUDIT_ENTITY_LABEL: Record<string, string> = {
  StockDocument: "Operațiune",
  Product: "Produs",
};

function AuditWorkspace({ data }: { data: AuditData }) {
  const filters: { key: string | undefined; label: string }[] = [
    { key: undefined, label: "Toate" },
    { key: "CREATE", label: "Creări" },
    { key: "UPDATE", label: "Editări" },
    { key: "DELETE", label: "Ștergeri" },
  ];

  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-[#e4e4e7] bg-white p-0.5">
        {filters.map((filter) => {
          const active = data.filters.act === filter.key;
          const href = crmAuditHref({
            act: filter.key,
            doc: data.filters.doc,
          });
          return (
            <Link
              key={filter.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-[#18181b] text-white" : "text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b]"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
        </div>
        {data.filters.doc ? (
          <>
            <StatusBadge tone="blue">Un singur document</StatusBadge>
            <FilterReset href={crmSectionHref("istoric")} />
          </>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
              <tr>
                <TableHead>Data și ora</TableHead>
                <TableHead secondary>Utilizator</TableHead>
                <TableHead>Acțiune</TableHead>
                <TableHead>Ce s-a întâmplat</TableHead>
                <TableHead align="right">Detalii</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.entries.length > 0 ? (
                data.entries.map((entry) => <AuditRowView key={entry.id} entry={entry} />)
              ) : (
                <tr>
                  <td className="px-3 py-12 text-center text-[#52525b]" colSpan={5}>
                    Nu există intrări în jurnal pentru filtrele curente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AuditRowView({ entry }: { entry: AuditRow }) {
  const meta = AUDIT_ACTION_META[entry.action] ?? {
    label: entry.action,
    tone: "gray" as const,
  };
  const canRestore =
    entry.action === "DELETE" &&
    entry.entity === "StockDocument" &&
    entry.hasDeletedSnapshot &&
    !entry.restoredDocumentId;

  return (
    <tr className="motion-table-row border-t border-[#f0f0f2] align-top hover:bg-[#fafafa]">
      <TableCell className="whitespace-nowrap font-mono text-xs">
        {dateTimeFormat.format(entry.createdAt)}
      </TableCell>
      <TableCell secondary>
        <p className="font-medium">{entry.userName || entry.userEmail || "—"}</p>
        {entry.userName && entry.userEmail ? (
          <p className="mt-0.5 text-xs text-[#71717a]">{entry.userEmail}</p>
        ) : null}
      </TableCell>
      <TableCell>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        <p className="mt-1 text-xs text-[#71717a]">
          {AUDIT_ENTITY_LABEL[entry.entity] ?? entry.entity}
        </p>
      </TableCell>
      <TableCell>{entry.summary}</TableCell>
      <TableCell align="right">
        <div className="flex flex-col items-end gap-2">
          {canRestore ? <RestoreButton auditId={entry.id} title={entry.summary} /> : null}
          {entry.restoredDocumentId ? (
            <StatusBadge tone="green">Restaurat</StatusBadge>
          ) : null}
          {entry.hasDetails ? (
            <AuditDetails id={entry.id} />
          ) : (
            <span className="text-xs text-[#71717a]">—</span>
          )}
        </div>
      </TableCell>
    </tr>
  );
}

