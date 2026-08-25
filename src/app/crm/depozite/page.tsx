import { Suspense } from "react";
import { AdminDeleteButton, WarehouseDialog } from "@/app/admin/admin-dialogs";
import { deleteWarehouseAction } from "@/app/admin/actions";
import type { WarehouseRow } from "@/lib/admin/queries";
import { getCatalogAdminData, type CatalogAdminData } from "@/lib/admin/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { AdminSection, RowActions, TableCell, WorkspaceSkeleton, adminRowCls } from "../_components/ui";
import { formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function WarehousesPage() {
  const appUser = await requireCrmSection("depozite");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getCatalogAdminData("depozite");

  return (
    <>
      <CrmHeader section="depozite" role={appUser.role}>
        {canModify ? <WarehouseDialog triggerLabel="Adaugă depozit" /> : null}
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
      head={["Depozit", "Implicit", "Activ", "Produse în stoc", canModify ? "Acțiuni" : null]}
      empty="Niciun depozit."
      isEmpty={data.warehouses.length === 0}
    >
      {data.warehouses.map((w: WarehouseRow) => (
        <tr key={w.id} className={adminRowCls}>
          <TableCell className="font-semibold text-[#1b1a17]">{w.name}</TableCell>
          <TableCell>{w.isDefault ? "Da" : "—"}</TableCell>
          <TableCell>{w.active ? "Da" : "Inactiv"}</TableCell>
          <TableCell align="right" className="font-mono">{formatNumber(w._count.stocks)}</TableCell>
          {canModify ? (
            <TableCell align="right">
              <RowActions>
                <WarehouseDialog warehouse={{ id: w.id, name: w.name, isDefault: w.isDefault, active: w.active }} triggerKind="row" triggerLabel="Editează" />
                <AdminDeleteButton action={deleteWarehouseAction} id={w.id} confirmLabel={`depozitul „${w.name}”`} />
              </RowActions>
            </TableCell>
          ) : null}
        </tr>
      ))}
    </AdminSection>
  );
}
