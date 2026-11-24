import { Suspense } from "react";
import Link from "next/link";
import { vehicleLabel } from "@/lib/catalog/vehicle-label";
import { getReorderList, REORDER_DAYS, type ReorderGroup } from "@/lib/operations/reorder";
import { CopyMessage } from "../_components/copy-message";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { StatusBadge, TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReorderPage() {
  const appUser = await requireCrmSection("de-comandat");
  const groupsPromise = getReorderList();

  return (
    <>
      <CrmHeader section="de-comandat" role={appUser.role} summary={<Suspense fallback={null}><Summary groupsPromise={groupsPromise} /></Suspense>}>
        <Link
          href="/crm/produse?stoc=mic"
          className="button-secondary inline-flex items-center rounded-full border border-(--c-line) bg-(--c-surface) px-3.5 py-2 text-sm font-medium text-(--c-ink) hover:bg-(--c-surface-2)"
        >
          Toate pe terminate
        </Link>
      </CrmHeader>
      <Suspense fallback={<WorkspaceSkeleton rows={6} />}>
        <Groups groupsPromise={groupsPromise} />
      </Suspense>
    </>
  );
}

async function Summary({ groupsPromise }: { groupsPromise: Promise<ReorderGroup[]> }) {
  const groups = await groupsPromise;
  const pieces = groups.reduce((sum, group) => sum + group.items.length, 0);
  const suppliers = groups.filter((group) => group.supplier).length;
  if (pieces === 0) return <>Vândute în ultimele {REORDER_DAYS} de zile și ajunse la prag.</>;
  return (
    <>
      {pieces} {pieces === 1 ? "piesă" : "piese"}
      {suppliers > 0 ? ` de la ${suppliers} ${suppliers === 1 ? "furnizor" : "furnizori"}` : ""}, vândute în ultimele {REORDER_DAYS} de zile
    </>
  );
}

async function Groups({ groupsPromise }: { groupsPromise: Promise<ReorderGroup[]> }) {
  const groups = await groupsPromise;
  if (groups.length === 0) {
    return (
      <section className="motion-page p-4 lg:px-6 lg:py-5">
        <div className="crm-card px-4 py-12 text-center text-sm text-(--c-muted)">
          Nimic de comandat. Piesele vândute care se termină apar aici singure.
        </div>
      </section>
    );
  }
  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      {groups.map((group) => (
        <div key={group.supplier?.id ?? "fara"} className="overflow-hidden crm-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--c-line) px-4 py-3">
            <h2 className="min-w-0 font-semibold text-(--c-ink)">
              {group.supplier?.name ?? "Fără furnizor cunoscut"}
              {group.supplier?.phone ? <span className="ml-2 text-sm font-normal text-(--c-muted)">{group.supplier.phone}</span> : null}
            </h2>
            <CopyMessage label="Copiază comanda" text={orderText(group)} phone={group.supplier?.phone ?? null} />
          </div>
          <div className="overflow-x-auto">
            <table className="crm-table crm-table-compact w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-(--c-surface-2) text-xs text-(--c-muted)">
                <tr>
                  <TableHead>Cod</TableHead>
                  <TableHead>Piesă</TableHead>
                  <TableHead align="right">Stoc</TableHead>
                  <TableHead align="right">De comandat</TableHead>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id} className="border-t border-(--c-line-2)">
                    <TableCell className="font-medium tabular-nums">{item.externalCode ?? "-"}</TableCell>
                    <TableCell>
                      {item.description}
                      <span className="block text-xs text-(--c-muted)">{vehicleLabel(item.fitment)}</span>
                    </TableCell>
                    <TableCell align="right">
                      <StatusBadge tone={item.stock <= 0 ? "red" : "amber"}>{item.stock}</StatusBadge>
                    </TableCell>
                    <TableCell align="right" className="font-semibold tabular-nums">{item.sold}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Comanda ca mesaj, gata de lipit în Viber/email la furnizor. */
function orderText(group: ReorderGroup) {
  const lines = group.items.map((item, index) => {
    const vehicle = vehicleLabel(item.fitment);
    return `${index + 1}. ${item.externalCode ? `${item.externalCode} ` : ""}${item.description}${vehicle ? ` (${vehicle})` : ""}: ${item.sold} buc.`;
  });
  return ["Bună ziua! Aș dori să comand:", ...lines, "Mulțumesc, Nadin Auto"].join("\n");
}
