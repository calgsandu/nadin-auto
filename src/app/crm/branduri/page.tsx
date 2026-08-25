import { Suspense } from "react";
import { AdminDeleteButton, BrandDialog } from "@/app/admin/admin-dialogs";
import { deleteBrandAction } from "@/app/admin/actions";
import type { BrandRow } from "@/lib/admin/queries";
import { getCatalogAdminData, type CatalogAdminData } from "@/lib/admin/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { AdminSection, RowActions, TableCell, WorkspaceSkeleton, adminRowCls } from "../_components/ui";
import { formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function BrandsPage() {
  const appUser = await requireCrmSection("branduri");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getCatalogAdminData("branduri");

  return (
    <>
      <CrmHeader section="branduri" role={appUser.role}>
        {canModify ? <BrandDialog triggerLabel="Adaugă brand" /> : null}
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
      head={["Brand", "Modele", canModify ? "Acțiuni" : null]}
      empty="Niciun brand."
      isEmpty={data.brands.length === 0}
    >
      {data.brands.map((b: BrandRow) => (
        <tr key={b.id} className={adminRowCls}>
          <TableCell className="font-semibold text-[#1b1a17]">{b.name}</TableCell>
          <TableCell align="right" className="font-mono">{formatNumber(b._count.models)}</TableCell>
          {canModify ? (
            <TableCell align="right">
              <RowActions>
                <BrandDialog entity={{ id: b.id, name: b.name }} triggerKind="row" triggerLabel="Editează" />
                <AdminDeleteButton action={deleteBrandAction} id={b.id} confirmLabel={`brandul „${b.name}”`} />
              </RowActions>
            </TableCell>
          ) : null}
        </tr>
      ))}
    </AdminSection>
  );
}
