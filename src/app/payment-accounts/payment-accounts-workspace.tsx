import { StatusBadge } from "@/app/crm/_components/ui";
import { PaymentAccountDialog } from "@/app/payment-accounts/payment-account-dialog";
import { PaymentAccountRowActions } from "@/app/payment-accounts/payment-account-row-actions";
import type { PaymentAccountsData } from "@/lib/payment-accounts/queries";
import { vehicleLabel } from "@/lib/catalog/vehicle-label";

const money = new Intl.NumberFormat("ro-MD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("ro-MD", { day: "2-digit", month: "2-digit", year: "numeric" });

export function PaymentAccountsWorkspace({
  data,
  canSubmitEFactura,
}: {
  data: PaymentAccountsData;
  canSubmitEFactura: boolean;
}) {
  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="flex justify-end">
        <PaymentAccountDialog customers={data.customers} warehouses={data.warehouses} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e4e4e7] bg-[#fafafa] text-xs text-[#52525b]">
              <tr>
                <Head>Cont</Head><Head>Client</Head><Head>Marfă</Head><Head>Flux</Head><Head right>Total</Head><Head right>Documente</Head>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((account) => (
                <tr key={account.id} className="border-t border-[#f0f0f2] align-top hover:bg-[#fafafa]">
                  <Cell>
                    <span className="font-semibold">#{account.number}</span>
                    <span className="mt-1 block text-xs text-[#52525b]">{date.format(account.issueDate)}</span>
                    {account.dueDate ? <span className="block text-xs text-[#71717a]">scadent {date.format(account.dueDate)}</span> : null}
                  </Cell>
                  <Cell>
                    <span className="font-semibold">{account.customerName}</span>
                    <span className="mt-1 block font-mono text-xs text-[#52525b]">IDNO {account.customerIdno}</span>
                  </Cell>
                  <Cell>
                    <div className="grid gap-1">
                      {account.lines.map((line) => {
                        const vehicle = vehicleLabel(line.product?.fitment);
                        return (
                          <span key={line.id}>
                            {line.productCode ? `${line.productCode} ` : ""}
                            {line.description} <span className="font-mono text-[#52525b]">×{line.quantity}</span>
                            {vehicle ? <span className="block text-xs text-[#52525b]">{vehicle}</span> : null}
                          </span>
                        );
                      })}
                    </div>
                    <span className="mt-2 block text-xs text-[#71717a]">Din {account.warehouse.name}</span>
                  </Cell>
                  <Cell><Flow account={account} /></Cell>
                  <Cell right><span className="font-mono font-semibold">{money.format(Number(account.totalGross))} lei</span></Cell>
                  <Cell right>
                    <PaymentAccountRowActions
                      cancelled={Boolean(account.cancelledAt)}
                      canSubmitEFactura={canSubmitEFactura}
                      dueDate={account.dueDate ? account.dueDate.toISOString().slice(0, 10) : ""}
                      notes={account.notes ?? ""}
                      eFacturaMessage={account.eFacturaMessage}
                      eFacturaResponseCode={account.eFacturaResponseCode}
                      eFacturaStatus={account.eFacturaStatus}
                      fulfilled={Boolean(account.fulfilledAt)}
                      id={account.id}
                      number={account.number}
                      paid={Boolean(account.paidAt)}
                    />
                  </Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.accounts.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-[#52525b]">Nu există conturi de plată.</p>
        ) : null}
      </div>
    </section>
  );
}

function Flow({ account }: { account: PaymentAccountsData["accounts"][number] }) {
  if (account.cancelledAt) return <StatusBadge tone="red">Anulat</StatusBadge>;
  const steps = [
    { label: "Emis", done: true },
    { label: "Achitat", done: Boolean(account.paidAt) },
    { label: "Predat", done: Boolean(account.fulfilledAt) },
  ];
  return (
    <div className="grid w-72 grid-cols-3 overflow-hidden rounded-md border border-[#e4e4e7]">
      {steps.map((step) => (
        <span key={step.label} className={`border-l border-[#e4e4e7] px-2 py-1.5 text-center text-xs font-semibold first:border-l-0 ${step.done ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-white text-[#71717a]"}`}>
          {step.done ? "● " : "○ "}{step.label}
        </span>
      ))}
    </div>
  );
}

function Head({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2.5 font-semibold ${right ? "text-right" : ""}`}>{children}</th>;
}
function Cell({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-3 py-3 ${right ? "text-right" : ""}`}>{children}</td>;
}
