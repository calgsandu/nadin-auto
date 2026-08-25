import { Suspense } from "react";
import { AdminDeleteButton, FitmentDialog } from "@/app/admin/admin-dialogs";
import { deleteFitmentAction } from "@/app/admin/actions";
import type { FitmentRow, ModelRow } from "@/lib/admin/queries";
import { ButtonSkeleton } from "../_components/ui";
import { formatYearLabel } from "../_components/format";
import { getCatalogAdminData, type CatalogAdminData } from "@/lib/admin/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { AdminSection, RowActions, TableCell, WorkspaceSkeleton, adminRowCls } from "../_components/ui";
import { formatNumber } from "../_components/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function FitmentsPage() {
  const appUser = await requireCrmSection("compatibilitati");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getCatalogAdminData("compatibilitati");

  return (
    <>
      <CrmHeader section="compatibilitati" role={appUser.role}>
        {canModify ? (
          <Suspense fallback={<ButtonSkeleton />}>
            <AddFitmentButton dataPromise={dataPromise} />
          </Suspense>
        ) : null}
      </CrmHeader>
      <Suspense fallback={<WorkspaceSkeleton rows={8} />}>
        <Loader dataPromise={dataPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

function fitmentModelOptions(models: ModelRow[]) {
  return models.map((m) => ({ id: m.id, label: `${m.brand.name} ${m.name}` }));
}

async function AddFitmentButton({ dataPromise }: { dataPromise: Promise<CatalogAdminData> }) {
  const data = await dataPromise;
  return (
    <FitmentDialog
      brands={data.brands}
      models={fitmentModelOptions(data.models)}
      triggerLabel="Adaugă compatibilitate"
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
  const models = fitmentModelOptions(data.models);

  return (
    <AdminSection
      head={["Compatibilitate", "Model", "Ani", "Produse", canModify ? "Acțiuni" : null]}
      empty="Nicio compatibilitate."
      isEmpty={data.fitments.length === 0}
      minWidth="820px"
    >
      {data.fitments.map((f: FitmentRow) => (
        <tr key={f.id} className={adminRowCls}>
          <TableCell className="font-semibold text-[#1b1a17]">
            {f.label}
            {f.labelRu ? <p className="mt-1 text-xs font-normal text-[#6f6b63]">RU: {f.labelRu}</p> : null}
          </TableCell>
          <TableCell>{f.carModel.brand.name} {f.carModel.name}</TableCell>
          <TableCell>{formatYearLabel(f.yearStart, f.yearEnd, f.yearOpenEnded)}</TableCell>
          <TableCell align="right" className="font-mono">{formatNumber(f._count.products)}</TableCell>
          {canModify ? (
            <TableCell align="right">
              <RowActions>
                <FitmentDialog
                  brands={data.brands}
                  models={models}
                  fitment={{ id: f.id, carModelId: f.carModelId, label: f.label, labelRu: f.labelRu, yearStart: f.yearStart, yearEnd: f.yearEnd, yearOpenEnded: f.yearOpenEnded }}
                  triggerKind="row"
                  triggerLabel="Editează"
                />
                <AdminDeleteButton action={deleteFitmentAction} id={f.id} confirmLabel={`compatibilitatea „${f.label}”`} />
              </RowActions>
            </TableCell>
          ) : null}
        </tr>
      ))}
    </AdminSection>
  );
}
