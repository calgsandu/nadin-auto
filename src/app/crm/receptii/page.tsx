import { Suspense } from "react";
import { getOperationsData, type OperationsData } from "@/lib/operations/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { ButtonSkeleton, WorkspaceSkeleton } from "../_components/ui";
import { StockAddButton, StockWorkspace } from "../_components/stock-workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReceiptsPage() {
  const appUser = await requireCrmSection("receptii");
  const canModify = canWriteCatalog(appUser.role);
  const operationsPromise = getOperationsData("receptii");

  return (
    <>
      <CrmHeader section="receptii" role={appUser.role}>
        {canModify ? (
          <Suspense fallback={<ButtonSkeleton />}>
            <StockAddButton activeSectionId="receptii" operationsPromise={operationsPromise} />
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
      activeSectionId="receptii"
      canModify={canModify}
      operations={operations}
    />
  );
}
