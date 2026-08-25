import { Suspense } from "react";
import { AdminDeleteButton, ModelDialog } from "@/app/admin/admin-dialogs";
import { deleteModelAction } from "@/app/admin/actions";
import type { ModelRow } from "@/lib/admin/queries";
import { ButtonSkeleton } from "../_components/ui";
import { getCatalogAdminData, type CatalogAdminData } from "@/lib/admin/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { AdminSection, RowActions, TableCell, WorkspaceSkeleton, adminRowCls } from "../_components/ui";
import { formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ModelsPage() {
  const appUser = await requireCrmSection("modele");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getCatalogAdminData("modele");

  return (
    <>
      <CrmHeader section="modele" role={appUser.role}>
        {canModify ? (
          <Suspense fallback={<ButtonSkeleton />}>
            <AddModelButton dataPromise={dataPromise} />
          </Suspense>
        ) : null}
      </CrmHeader>
      <Suspense fallback={<WorkspaceSkeleton rows={8} />}>
        <Loader dataPromise={dataPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function AddModelButton({ dataPromise }: { dataPromise: Promise<CatalogAdminData> }) {
  const data = await dataPromise;
  return (
    <ModelDialog
      brands={data.brands.map((b) => ({ id: b.id, name: b.name }))}
      triggerLabel="Adaugă model"
    />
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
  const brands = data.brands.map((b) => ({ id: b.id, name: b.name }));

  return (
    <AdminSection
      head={["Model", "Brand", "Compatibilități", canModify ? "Acțiuni" : null]}
      empty="Niciun model."
      isEmpty={data.models.length === 0}
    >
      {data.models.map((m: ModelRow) => (
        <tr key={m.id} className={adminRowCls}>
          <TableCell className="font-semibold text-[#1b1a17]">{m.name}</TableCell>
          <TableCell>{m.brand.name}</TableCell>
          <TableCell align="right" className="font-mono">{formatNumber(m._count.fitments)}</TableCell>
          {canModify ? (
            <TableCell align="right">
              <RowActions>
                <ModelDialog brands={brands} model={{ id: m.id, name: m.name, brandId: m.brandId }} triggerKind="row" triggerLabel="Editează" />
                <AdminDeleteButton action={deleteModelAction} id={m.id} confirmLabel={`modelul „${m.brand.name} ${m.name}”`} />
              </RowActions>
            </TableCell>
          ) : null}
        </tr>
      ))}
    </AdminSection>
  );
}
