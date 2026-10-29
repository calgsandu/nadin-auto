import { Suspense } from "react";
import { getOperationsData, type OperationsData } from "@/lib/operations/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { ButtonSkeleton, WorkspaceSkeleton } from "../_components/ui";
import { StockAddButton, StockWorkspace } from "../_components/stock-workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function TransfersPage() {
  const appUser = await requireCrmSection("transferuri");
  const canModify = canWriteCatalog(appUser.role);
  const operationsPromise = getOperationsData("transferuri");

  return (
    <>
      <CrmHeader section="transferuri" role={appUser.role}>
        {canModify ? (
          <Suspense fallback={<ButtonSkeleton />}>
            <StockAddButton activeSectionId="transferuri" operationsPromise={operationsPromise} />
          </Suspense>
        ) : null}
      </CrmHeader>
      <Suspense fallback={<WorkspaceSkeleton rows={5} />}>
        <Loader operationsPromise={operationsPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function Loader({
  operationsPromise,
  canModify,
}: {
  operationsPromise: Promise<OperationsData>;
  canModify: boolean;
}) {
  const operations = await operationsPromise;
  return (
    <StockWorkspace
      activeSectionId="transferuri"
      canModify={canModify}
      operations={operations}
    />
  );
}
