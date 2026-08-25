import { Suspense } from "react";
import { PartnerFormDialog, type PartnerFormValue } from "@/app/partners/partner-form-dialog";
import { PartnerDeleteButton } from "@/app/partners/partner-delete-button";
import { PartnerPaymentDialog } from "@/app/partners/payment-dialog";
import { getPartnersData, type PartnerRow } from "@/lib/partners/queries";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import { TableCell, TableHead, WorkspaceSkeleton } from "../_components/ui";
import { formatMoney, formatNumber, formatText } from "../_components/format";

type PartnersData = Awaited<ReturnType<typeof getPartnersData>>;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function PartnersPage() {
  const appUser = await requireCrmSection("furnizori");
  const canModify = canWriteCatalog(appUser.role);
  const dataPromise = getPartnersData();

  return (
    <>
      <CrmHeader section="furnizori" role={appUser.role}>
        {canModify ? <PartnerFormDialog triggerLabel="Adaugă partener" /> : null}
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
  dataPromise: Promise<PartnersData>;
  canModify: boolean;
}) {
  const data = await dataPromise;
  return <PartnersWorkspace canModify={canModify} partners={data.partners} />;
}

function PartnersWorkspace({
  canModify,
  partners,
}: {
  canModify: boolean;
  partners: PartnerRow[];
}) {
  return (
    <section className="motion-page p-4 lg:p-5">
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Nume</TableHead>
                <TableHead secondary>Tip</TableHead>
                <TableHead secondary>IDNO / TVA</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead secondary>Adresă</TableHead>
                <TableHead align="right">Datorie</TableHead>
                <TableHead align="right" secondary>Documente</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr
                  key={partner.id}
                  className="motion-table-row border-t border-[#efeeeb] align-top hover:bg-[#f6f6f4]"
                >
                  <TableCell className="font-semibold text-[#1b1a17]">
                    {partner.name}
                  </TableCell>
                  <TableCell secondary>{formatPartnerKind(partner.kind)}</TableCell>
                  <TableCell secondary className="text-xs tabular-nums">
                    <span className="block">{formatText(partner.idno)}</span>
                    {partner.vatCode ? <span className="mt-0.5 block text-[#98948b]">TVA {partner.vatCode}</span> : null}
                  </TableCell>
                  <TableCell className="text-[#6f6b63]">
                    <span className="block">{formatText(partner.phone)}</span>
                    {partner.email ? <span className="mt-0.5 block">{partner.email}</span> : null}
                  </TableCell>
                  <TableCell secondary className="max-w-xs text-[#6f6b63]">
                    {formatText(partner.address)}
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={`font-mono font-semibold ${
                        partner.balanceLei > 0 ? "text-[#b91c1c]" : "text-[#6f6b63]"
                      }`}
                    >
                      {partner.balanceLei !== 0 ? `${formatMoney(partner.balanceLei)} lei` : "—"}
                    </span>
                  </TableCell>
                  <TableCell align="right" secondary>
                    <span className="font-semibold tabular-nums text-[#1b1a17]">
                      {formatNumber(partner._count.documents + partner._count.paymentAccounts)}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#98948b]">
                      {partner._count.paymentAccounts} conturi
                    </span>
                  </TableCell>
                  {canModify ? (
                    <TableCell align="right">
                      <div className="flex justify-end gap-2">
                        <PartnerPaymentDialog
                          partnerId={partner.id}
                          partnerName={partner.name}
                          balanceLei={partner.balanceLei}
                        />
                        <PartnerFormDialog
                          partner={toPartnerFormValue(partner)}
                          triggerKind="row"
                          triggerLabel="Editează"
                        />
                        <PartnerDeleteButton
                          partnerId={partner.id}
                          partnerName={partner.name}
                        />
                      </div>
                    </TableCell>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {partners.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">
            Nu există parteneri încă.
          </div>
        ) : null}
      </div>
    </section>
  );
}


function toPartnerFormValue(partner: PartnerRow): PartnerFormValue {
  return {
    id: partner.id,
    name: partner.name,
    kind: partner.kind,
    phone: partner.phone ?? "",
    email: partner.email ?? "",
    address: partner.address ?? "",
    idno: partner.idno ?? "",
    vatCode: partner.vatCode ?? "",
    iban: partner.iban ?? "",
    bankName: partner.bankName ?? "",
    bankCode: partner.bankCode ?? "",
    notes: partner.notes ?? "",
  };
}

function formatPartnerKind(kind: PartnerRow["kind"]) {
  if (kind === "SUPPLIER") return "Furnizor";
  if (kind === "CUSTOMER") return "Client";
  return "Furnizor și client";
}

