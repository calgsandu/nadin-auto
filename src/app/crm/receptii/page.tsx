import { Suspense } from "react";
import { getOperationsData, type OperationsData } from "@/lib/operations/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { WorkspaceSkeleton } from "../_components/ui";
import { StockWorkspace } from "../_components/stock-workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ReceiptsPage() {
  const appUser = await requireCrmSection("receptii");
  const canModify = canWriteCatalog(appUser.role);
  const operationsPromise = getOperationsData("receptii");

  return (
    <>
      <CrmHeader section="receptii" role={appUser.role} />
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
