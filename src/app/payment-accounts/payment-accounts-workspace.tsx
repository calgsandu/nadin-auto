import { AlertTriangle, CalendarClock, CheckCircle2, PackageCheck, Truck } from "lucide-react";
import { HeroPanel, StatusBadge } from "@/app/crm/_components/ui";
import { PaymentAccountRowActions } from "@/app/payment-accounts/payment-account-row-actions";
import { CopyMessage } from "@/app/crm/_components/copy-message";
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
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const live = data.accounts.filter((account) => !account.cancelledAt);
  const unpaid = live.filter((account) => !account.paidAt);
  const sum = (rows: typeof live) => rows.reduce((total, account) => total + Number(account.totalGross), 0);
  const overdue = unpaid.filter((account) => account.dueDate && account.dueDate < now);
  const dueSoon = unpaid.filter((account) => account.dueDate && account.dueDate >= now && account.dueDate <= soon);
  const later = unpaid.filter((account) => !overdue.includes(account) && !dueSoon.includes(account));
  const paidThisMonth = live.filter((account) => account.paidAt && account.paidAt >= monthStart);
  const toDeliver = live.filter((account) => account.paidAt && !account.fulfilledAt);

  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-3">
      {live.length > 0 ? (
        <HeroPanel
          label="Neachitate"
          value={`${money.format(sum(unpaid))} lei`}
          note={`în ${unpaid.length} ${unpaid.length === 1 ? "proformă" : "proforme"}`}
          segments={[
            { label: "Restante", value: `${money.format(sum(overdue))} lei`, amount: sum(overdue), tone: "red" as const, note: `${overdue.length} proforme` },
            { label: "Scadente în 7 zile", value: `${money.format(sum(dueSoon))} lei`, amount: sum(dueSoon), tone: "yellow" as const, note: `${dueSoon.length} proforme` },
            { label: "Mai târziu", value: `${money.format(sum(later))} lei`, amount: sum(later), tone: "blue" as const, note: `${later.length} proforme` },
          ].filter((segment) => segment.amount > 0)}
          stats={[
            { label: "Achitate luna aceasta", value: `${money.format(sum(paidThisMonth))} lei`, hint: `${paidThisMonth.length} proforme`, icon: CheckCircle2, tone: "green" },
            { label: "Achitate, de predat", value: String(toDeliver.length), hint: toDeliver.length > 0 ? `${money.format(sum(toDeliver))} lei` : "nimic de predat", icon: Truck, tone: "yellow" },
            { label: "Emise în total", value: String(live.length), icon: PackageCheck, tone: "lilac" },
          ]}
        />
      ) : null}
      <div className="overflow-hidden crm-card">
        <div className="overflow-x-auto">
          <table className="crm-table w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead className="border-b border-(--c-line) bg-(--c-surface-2) text-xs text-(--c-muted)">
              <tr>
                <Head>Cont</Head><Head>Client</Head><Head>Marfă</Head><Head>Status</Head><Head right>Total</Head><Head right>Documente</Head>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((account) => (
                <tr key={account.id} className="border-t border-(--c-line-2) align-top hover:bg-(--c-surface-2)">
                  <Cell>
                    <span className="font-semibold">#{account.number}</span>
                    <span className="mt-1 block text-xs text-(--c-muted)">{date.format(account.issueDate)}</span>
                    {account.dueDate ? <span className="block text-xs text-(--c-muted-2)">scadent {date.format(account.dueDate)}</span> : null}
                  </Cell>
                  <Cell>
                    <div className="flex items-center gap-3">
                      <Initials name={account.customerName} />
                      <div className="min-w-0">
                        <span className="block font-semibold">{account.customerName}</span>
                        <span className="block text-xs tabular-nums text-(--c-muted-2)">IDNO {account.customerIdno}</span>
                      </div>
                    </div>
                  </Cell>
                  <Cell>
                    <div className="grid gap-1">
                      {account.lines.map((line) => {
                        const vehicle = vehicleLabel(line.product?.fitment);
                        return (
                          <span key={line.id}>
                            {line.productCode ? `${line.productCode} ` : ""}
                            {line.description} <span className="tabular-nums text-(--c-muted)">×{line.quantity}</span>
                            {vehicle ? <span className="block text-xs text-(--c-muted)">{vehicle}</span> : null}
                          </span>
                        );
                      })}
                    </div>
                    <span className="mt-2 block text-xs text-(--c-muted-2)">Din {account.warehouse.name}</span>
                  </Cell>
                  <Cell>
                    <Flow account={account} now={now} />
                    {!account.cancelledAt && !account.paidAt && account.dueDate && account.dueDate <= soon ? (
                      <CopyMessage className="mt-2" label="Amintește clientului" text={reminderText(account, now)} phone={account.customerPhone} />
                    ) : null}
                  </Cell>
                  <Cell right><span className="tabular-nums font-semibold">{money.format(Number(account.totalGross))} lei</span></Cell>
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
          <p className="px-4 py-12 text-center text-sm text-(--c-muted)">Nu există conturi de plată.</p>
        ) : null}
      </div>
    </section>
  );
}

const DAY = 24 * 60 * 60 * 1000;

/** Textul mementoului, gata de trimis pe Viber/SMS. */
function reminderText(account: PaymentAccountsData["accounts"][number], now: Date) {
  const due = account.dueDate!;
  const late = Math.floor((now.getTime() - due.getTime()) / DAY);
  const term =
    late > 0
      ? `Termenul de plată (${date.format(due)}) a fost depășit cu ${late} ${late === 1 ? "zi" : "zile"}.`
      : `Termenul de plată este ${date.format(due)}.`;
  return [
    "Bună ziua!",
    `Vă reamintim de contul de plată nr. ${account.number} din ${date.format(account.issueDate)}, în sumă de ${money.format(Number(account.totalGross))} lei. ${term}`,
    "Dacă ați achitat deja, vă rugăm să ignorați acest mesaj. Mulțumim!",
    "Nadin Auto",
  ].join("\n");
}

/** Un singur status, cel care cere ceva: restanța bate scadența, predarea bate achitarea. */
function Flow({ account, now }: { account: PaymentAccountsData["accounts"][number]; now: Date }) {
  if (account.cancelledAt) return <StatusBadge tone="gray">Anulat</StatusBadge>;
  if (account.fulfilledAt) return <StatusBadge tone="green"><CheckCircle2 aria-hidden="true" />Achitat și predat</StatusBadge>;
  if (account.paidAt) return <StatusBadge tone="blue"><Truck aria-hidden="true" />Achitat, de predat</StatusBadge>;
  if (!account.dueDate) return <StatusBadge tone="gray">Emis</StatusBadge>;
  const days = Math.ceil((account.dueDate.getTime() - now.getTime()) / DAY);
  if (days < 0) {
    return <StatusBadge tone="red"><AlertTriangle aria-hidden="true" />Restant de {-days} {-days === 1 ? "zi" : "zile"}</StatusBadge>;
  }
  return (
    <StatusBadge tone={days <= 7 ? "amber" : "gray"}>
      <CalendarClock aria-hidden="true" />
      {days === 0 ? "Scadent azi" : `Scadent în ${days} ${days === 1 ? "zi" : "zile"}`}
    </StatusBadge>
  );
}

function Initials({ name }: { name: string }) {
  const letters = name
    .replace(/["„”«»]/g, "")
    .split(/\s+/)
    .filter((part) => part.length > 1)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-(--c-line-2) text-xs font-semibold text-(--c-ink-2)">
      {letters || "?"}
    </span>
  );
}

function Head({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2.5 font-semibold ${right ? "text-right" : ""}`}>{children}</th>;
}
function Cell({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-3 py-3 ${right ? "text-right" : ""}`}>{children}</td>;
}
