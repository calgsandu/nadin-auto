import { PaymentAccountDialog } from "@/app/payment-accounts/payment-account-dialog";
import { PaymentAccountRowActions } from "@/app/payment-accounts/payment-account-row-actions";
import type { PaymentAccountsData } from "@/lib/payment-accounts/queries";

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
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8e7e3] bg-white px-4 py-3">
        <div>
          <p className="font-semibold text-[#1b1a17]">Înainte de vânzare</p>
          <p className="mt-0.5 text-sm text-[#6f6b63]">Contul nu rezervă și nu scade stocul. Stocul se schimbă numai la „Predă marfa”.</p>
        </div>
        <PaymentAccountDialog customers={data.customers} warehouses={data.warehouses} />
      </div>

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9] text-xs text-[#6f6b63]">
              <tr>
                <Head>Cont</Head><Head>Client</Head><Head>Marfă</Head><Head>Flux</Head><Head right>Total</Head><Head right>Documente</Head>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((account) => (
                <tr key={account.id} className="border-t border-[#efeeeb] align-top hover:bg-[#fafaf9]">
                  <Cell>
                    <span className="font-semibold">#{account.number}</span>
                    <span className="mt-1 block text-xs text-[#6f6b63]">{date.format(account.issueDate)}</span>
                    {account.dueDate ? <span className="block text-xs text-[#98948b]">scadent {date.format(account.dueDate)}</span> : null}
                  </Cell>
                  <Cell>
                    <span className="font-semibold">{account.customerName}</span>
                    <span className="mt-1 block font-mono text-xs text-[#6f6b63]">IDNO {account.customerIdno}</span>
                  </Cell>
                  <Cell>
                    <div className="grid gap-1">
                      {account.lines.map((line) => (
                        <span key={line.id}>{line.productCode ? `${line.productCode} · ` : ""}{line.description} <span className="font-mono text-[#6f6b63]">×{line.quantity}</span></span>
                      ))}
                    </div>
                    <span className="mt-2 block text-xs text-[#98948b]">Din {account.warehouse.name}</span>
                  </Cell>
                  <Cell><Flow account={account} /></Cell>
                  <Cell right><span className="font-mono font-semibold">{money.format(Number(account.totalGross))} lei</span></Cell>
                  <Cell right>
                    <PaymentAccountRowActions
                      cancelled={Boolean(account.cancelledAt)}
                      canSubmitEFactura={canSubmitEFactura}
                      eFacturaMessage={account.eFacturaMessage}
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
          <div className="px-4 py-14 text-center">
            <p className="font-medium text-[#1b1a17]">Nu există conturi de plată.</p>
            <p className="mt-1 text-sm text-[#6f6b63]">Emite primul cont pentru un client cu IDNO și adresă completate.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Flow({ account }: { account: PaymentAccountsData["accounts"][number] }) {
  if (account.cancelledAt) return <span className="inline-flex rounded-full bg-[#fef2f2] px-2.5 py-1 text-xs font-semibold text-[#b91c1c]">Anulat</span>;
  const steps = [
    { label: "Emis", done: true },
    { label: "Achitat", done: Boolean(account.paidAt) },
    { label: "Predat", done: Boolean(account.fulfilledAt) },
  ];
  return (
    <div className="grid w-72 grid-cols-3 overflow-hidden rounded-md border border-[#e8e7e3]">
      {steps.map((step) => (
        <span key={step.label} className={`border-l border-[#e8e7e3] px-2 py-1.5 text-center text-xs font-semibold first:border-l-0 ${step.done ? "bg-[#fffbeb] text-[#92400e]" : "bg-white text-[#98948b]"}`}>
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
