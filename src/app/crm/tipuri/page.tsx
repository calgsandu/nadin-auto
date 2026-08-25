import { Suspense } from "react";
import { AdminDeleteButton, TypeDialog } from "@/app/admin/admin-dialogs";
import { deleteTypeAction } from "@/app/admin/actions";
import type { TypeRow } from "@/lib/admin/queries";
import { getCatalogAdminData, type CatalogAdminData } from "@/lib/admin/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { AdminSection, RowActions, TableCell, WorkspaceSkeleton, adminRowCls } from "../_components/ui";
import { formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function TypesPage() {
  const appUser = await requireCrmSection("tipuri");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getCatalogAdminData("tipuri");

  return (
    <>
      <CrmHeader section="tipuri" role={appUser.role}>
        {canModify ? <TypeDialog triggerLabel="Adaugă tip" /> : null}
      </CrmHeader>
      <Suspense fallback={<WorkspaceSkeleton rows={8} />}>
        <Loader dataPromise={dataPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  canModify,
}: {
  dataPromise: Promise<CatalogAdminData>;
  canModify: boolean;
}) {
  const data = await dataPromise;

  return (
    <AdminSection
      head={["Tip produs", "Produse", canModify ? "Acțiuni" : null]}
      empty="Niciun tip."
      isEmpty={data.types.length === 0}
    >
      {data.types.map((t: TypeRow) => (
        <tr key={t.id} className={adminRowCls}>
          <TableCell className="font-semibold text-[#1b1a17]">
            {t.name}
            {t.nameRu ? <p className="mt-1 text-xs font-normal text-[#6f6b63]">RU: {t.nameRu}</p> : null}
          </TableCell>
          <TableCell align="right" className="font-mono">{formatNumber(t._count.products)}</TableCell>
          {canModify ? (
            <TableCell align="right">
              <RowActions>
                <TypeDialog entity={{ id: t.id, name: t.name, nameRu: t.nameRu }} triggerKind="row" triggerLabel="Editează" />
                <AdminDeleteButton action={deleteTypeAction} id={t.id} confirmLabel={`tipul „${t.name}”`} />
              </RowActions>
            </TableCell>
          ) : null}
        </tr>
      ))}
    </AdminSection>
  );
}
