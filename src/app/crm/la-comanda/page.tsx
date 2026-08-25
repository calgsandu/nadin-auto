import { Suspense } from "react";
import { ExternalOrdersWorkspace } from "@/app/external-orders/external-orders-workspace";
import { getExternalOrdersData, type ExternalOrdersData } from "@/lib/external-orders/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { WorkspaceSkeleton } from "../_components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ExternalOrdersPage() {
  const appUser = await requireCrmSection("la-comanda");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getExternalOrdersData();

  return (
    <>
      <CrmHeader section="la-comanda" role={appUser.role} />
      <Suspense fallback={<WorkspaceSkeleton cards={4} rows={5} />}>
        <Loader dataPromise={dataPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function Loader({
  dataPromise,
  canModify,
}: {
  dataPromise: Promise<ExternalOrdersData>;
  canModify: boolean;
}) {
  const data = await dataPromise;
  return <ExternalOrdersWorkspace canDelete={canModify} data={data} />;
}
