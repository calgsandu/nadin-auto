import { Suspense } from "react";
import { PaymentAccountDialog } from "@/app/payment-accounts/payment-account-dialog";
import { PaymentAccountsWorkspace } from "@/app/payment-accounts/payment-accounts-workspace";
import { getPaymentAccountsData } from "@/lib/payment-accounts/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { ButtonSkeleton, WorkspaceSkeleton } from "../_components/ui";

type PaymentAccountsData = Awaited<ReturnType<typeof getPaymentAccountsData>>;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PaymentAccountsPage() {
  const appUser = await requireCrmSection("conturi-plata");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getPaymentAccountsData();

  return (
    <>
      <CrmHeader section="conturi-plata" role={appUser.role}>
        <Suspense fallback={<ButtonSkeleton />}>
          <HeaderAction dataPromise={dataPromise} />
        </Suspense>
      </CrmHeader>
      <Suspense fallback={<WorkspaceSkeleton cards={4} rows={5} />}>
        <Loader dataPromise={dataPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function HeaderAction({ dataPromise }: { dataPromise: Promise<PaymentAccountsData> }) {
  const data = await dataPromise;
  return <PaymentAccountDialog customers={data.customers} warehouses={data.warehouses} />;
}

async function Loader({
  dataPromise,
  canModify,
}: {
  dataPromise: Promise<PaymentAccountsData>;
  canModify: boolean;
}) {
  const data = await dataPromise;
  return <PaymentAccountsWorkspace canSubmitEFactura={canModify} data={data} />;
}
