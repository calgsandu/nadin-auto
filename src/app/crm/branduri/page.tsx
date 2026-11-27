import { BrandName } from "@/app/components/brand-logo";
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
      head={["Marcă", "Modele", canModify ? "Acțiuni" : null]}
      empty="Niciun brand."
      isEmpty={data.brands.length === 0}
    >
      {data.brands.map((b: BrandRow) => (
        <tr key={b.id} className={adminRowCls}>
          <TableCell className="font-medium text-(--c-ink)"><BrandName name={b.name} /></TableCell>
          <TableCell className="tabular-nums text-(--c-muted)">{formatNumber(b._count.models)}</TableCell>
          {canModify ? (
            <TableCell align="right">
              <RowActions>
                <BrandDialog entity={{ id: b.id, name: b.name }} triggerKind="row" triggerLabel="Editează" />
                <div className="flex justify-end gap-1.5">
                  <AdminDeleteButton action={deleteBrandAction} id={b.id} confirmLabel={`brandul „${b.name}”`} />
                </div>
              </RowActions>
            </TableCell>
          ) : null}
        </tr>
      ))}
    </AdminSection>
  );
}
