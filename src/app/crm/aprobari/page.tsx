import { Suspense } from "react";
import { ApprovalWorkspace } from "@/app/aprobari/approval-workspace";
import { getApprovalsData, type ApprovalsData } from "@/lib/audit/queries";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { WorkspaceSkeleton } from "../_components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ApprovalsPage() {
  const appUser = await requireCrmSection("aprobari");
  const dataPromise = getApprovalsData();

  return (
    <>
      <CrmHeader section="aprobari" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton rows={5} />}>
        <Loader dataPromise={dataPromise} />
      </Suspense>
    </>
  );
}

async function Loader({ dataPromise }: { dataPromise: Promise<ApprovalsData> }) {
  const data = await dataPromise;
  return <ApprovalWorkspace data={data} />;
}
