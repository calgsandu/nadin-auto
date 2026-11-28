import { Suspense } from "react";
import { PartnerFormDialog, type PartnerFormValue } from "@/app/partners/partner-form-dialog";
import { PartnerDeleteButton } from "@/app/partners/partner-delete-button";
import { RowMenu } from "@/app/components/row-menu";
import { PartnerPaymentDialog } from "@/app/partners/payment-dialog";
import { PartnerLedgerButton } from "@/app/partners/partner-ledger-button";
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
        {canModify ? <PartnerFormDialog defaultKind="SUPPLIER" triggerLabel="Adaugă furnizor" /> : null}
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
    <section className="motion-page p-4 lg:px-6 lg:py-3">
      <div className="overflow-hidden crm-card">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-(--c-line) bg-(--c-surface-2)">
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
                  className="motion-table-row border-t border-(--c-line-2) align-top hover:bg-(--c-surface-2)"
                >
                  <TableCell className="font-semibold text-(--c-ink)">
                    {partner.name}
                  </TableCell>
                  <TableCell secondary>{formatPartnerKind(partner.kind)}</TableCell>
                  <TableCell secondary className="text-xs tabular-nums">
                    <span className="block">{formatText(partner.idno)}</span>
                    {partner.vatCode ? <span className="mt-0.5 block text-(--c-muted-2)">TVA {partner.vatCode}</span> : null}
                  </TableCell>
                  <TableCell className="text-(--c-muted)">
                    <span className="block">{formatText(partner.phone)}</span>
                    {partner.email ? <span className="mt-0.5 block">{partner.email}</span> : null}
                  </TableCell>
                  <TableCell secondary className="max-w-xs text-(--c-muted)">
                    {formatText(partner.address)}
                    {/* Se scriau („Observații, condiții de livrare") și se citeau
                        doar ca să reumple același formular. */}
                    {partner.notes ? (
                      <span className="mt-0.5 block text-xs text-(--c-muted-2)">{partner.notes}</span>
                    ) : null}
                  </TableCell>
                  <TableCell align="right">
                    <span
                      className={`tabular-nums font-semibold ${
                        partner.balanceLei > 0 ? "text-(--c-red)" : "text-(--c-muted)"
                      }`}
                    >
                      {partner.balanceLei !== 0 ? `${formatMoney(partner.balanceLei)} lei` : "—"}
                    </span>
                  </TableCell>
                  <TableCell align="right" secondary>
                    <span className="font-semibold tabular-nums text-(--c-ink)">
                      {formatNumber(partner._count.documents + partner._count.paymentAccounts)}
                    </span>
                    <span className="mt-0.5 block text-xs text-(--c-muted-2)">
                      {partner._count.paymentAccounts} conturi
                    </span>
                  </TableCell>
                  {canModify ? (
                    <TableCell align="right">
                      <div className="flex justify-end gap-1.5">
                        <PartnerLedgerButton
                          balanceLei={partner.balanceLei}
                          partnerId={partner.id}
                          partnerName={partner.name}
                        />
                        <RowMenu label={partner.name}>
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
                        </RowMenu>
                      </div>
                    </TableCell>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {partners.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-(--c-muted)">
            Nu există furnizori încă.
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
    discountPercent:
      partner.discountPercent === null ? "" : String(partner.discountPercent),
  };
}

function formatPartnerKind(kind: PartnerRow["kind"]) {
  if (kind === "SUPPLIER") return "Furnizor";
  if (kind === "CUSTOMER") return "Client";
  return "Furnizor și client";
}

