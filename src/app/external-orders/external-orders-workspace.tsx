import type { ReactNode } from "react";
import {
  ExternalOrderDialog,
  type ExternalOrderFormValue,
} from "@/app/external-orders/external-order-dialog";
import {
  OrderDeleteButton,
  OrderStatusControl,
} from "@/app/external-orders/order-row-actions";
import { CircleCheck, TrendingUp, Truck } from "lucide-react";
import { DailyMetric, StatusBadge as Badge, type BadgeTone } from "@/app/crm/_components/ui";
import { STATUS_LABELS } from "@/lib/external-orders/status";
import type {
  ExternalOrderRow,
  ExternalOrdersData,
} from "@/lib/external-orders/queries";
import type { ExternalOrderStatus } from "@/generated/prisma/enums";

/**
 * Comenzi back-to-back prin furnizori parteneri: piesa nu intră niciodată în
 * catalogul sau stocul propriu — doar clientul, furnizorul, costul și marja.
 */
export function ExternalOrdersWorkspace({
  data,
  canDelete,
}: {
  data: ExternalOrdersData;
  canDelete: boolean;
}) {
  const delivered = data.archive.filter((order) => order.status === "LIVRAT");
  const deliveredMargin = delivered.reduce((sum, order) => sum + (orderMargin(order) ?? 0), 0);

  return (
    <section className="motion-page grid grid-cols-1 gap-4 p-4 lg:px-6 lg:py-5">
      <div className="stat-strip grid sm:grid-cols-3">
        <DailyMetric icon={Truck} label="Comenzi active" value={formatNumber(data.active.length)} />
        <DailyMetric icon={CircleCheck} label="Livrate" value={formatNumber(delivered.length)} />
        <DailyMetric icon={TrendingUp} label="Marjă totală (livrate)" value={`${formatMoney(deliveredMargin)} lei`} />
      </div>

      <div className="flex justify-end">
        <ExternalOrderDialog suppliers={data.suppliers} triggerLabel="Comandă nouă" />
      </div>

      <OrdersTable
        title="Comenzi în lucru"
        emptyLabel="Nu sunt comenzi active."
        orders={data.active}
        suppliers={data.suppliers}
        canDelete={canDelete}
        showActions
      />

      <OrdersTable
        title="Arhivă (livrate și anulate)"
        emptyLabel="Arhiva este goală."
        orders={data.archive}
        suppliers={data.suppliers}
        canDelete={canDelete}
        showActions={false}
      />
    </section>
  );
}

function OrdersTable({
  title,
  emptyLabel,
  orders,
  suppliers,
  canDelete,
  showActions,
}: {
  title: string;
  emptyLabel: string;
  orders: ExternalOrderRow[];
  suppliers: ExternalOrdersData["suppliers"];
  canDelete: boolean;
  showActions: boolean;
}) {
  const actionColumns = (showActions ? 1 : 0) + (canDelete ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
      <div className="border-b border-[#e4e4e7] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-[#18181b]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="crm-table w-full sm:min-w-[1080px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
            <tr>
              <TableHead className="max-sm:hidden">Nr.</TableHead>
              <TableHead className="max-sm:hidden">Client</TableHead>
              <TableHead>Piesa</TableHead>
              <TableHead className="max-sm:hidden">Furnizor</TableHead>
              <TableHead className="max-sm:hidden" align="right">Cant.</TableHead>
              <TableHead className="max-sm:hidden" align="right">Cost / buc</TableHead>
              <TableHead className="max-sm:hidden" align="right">Vânzare / buc</TableHead>
              <TableHead className="max-sm:hidden" align="right">Marjă</TableHead>
              <TableHead className="max-sm:hidden">Status</TableHead>
              {actionColumns > 0 ? <TableHead align="right">Acțiuni</TableHead> : null}
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map((order) => (
                <tr key={order.id} className="motion-table-row border-t border-[#f0f0f2] align-top hover:bg-[#fafafa]">
                  <TableCell className="font-mono text-xs font-semibold max-sm:hidden">#{order.number}</TableCell>
                  <TableCell className="max-sm:hidden">
                    <p className="font-medium text-[#18181b]">{order.customerName}</p>
                    {order.customerPhone ? (
                      <p className="mt-0.5 font-mono text-xs text-[#52525b]">{order.customerPhone}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-[#18181b]">{order.productName}</p>
                    {order.productCode ? (
                      <p className="mt-0.5 font-mono text-xs text-[#52525b]">{order.productCode}</p>
                    ) : null}
                    {order.notes ? (
                      <p className="mt-0.5 text-xs text-[#52525b]">{order.notes}</p>
                    ) : null}
                    {/* Pe telefon: clientul, cantitatea, prețul și statusul sub piesă. */}
                    <div className="mt-1.5 grid gap-1 text-xs text-[#52525b] sm:hidden">
                      <p>
                        #{order.number} · {order.customerName} · x{formatNumber(order.quantity)}
                        {order.salePriceLei != null ? ` · ${formatMoney(order.salePriceLei)} lei` : ""}
                      </p>
                      <div>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-sm:hidden">
                    {order.supplierName ?? <span className="text-[#71717a]">de stabilit</span>}
                    {order.offerValidUntil ? (
                      // Oferta expirată nu era semnalată nicăieri: comanda se
                      // confirma la un preț care nu mai era valabil.
                      <p
                        className={`mt-0.5 text-xs ${
                          isExpiredOffer(order.status, order.offerValidUntil)
                            ? "font-semibold text-[#b91c1c]"
                            : "text-[#52525b]"
                        }`}
                      >
                        {isExpiredOffer(order.status, order.offerValidUntil)
                          ? `Ofertă expirată la ${formatDate(order.offerValidUntil)}`
                          : `Ofertă până la ${formatDate(order.offerValidUntil)}`}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell align="right" className="font-mono max-sm:hidden">{formatNumber(order.quantity)}</TableCell>
                  <TableCell align="right" className="font-mono max-sm:hidden">
                    {order.supplierPriceLei != null ? `${formatMoney(order.supplierPriceLei)} lei` : "—"}
                  </TableCell>
                  <TableCell align="right" className="font-mono font-semibold max-sm:hidden">
                    {order.salePriceLei != null ? `${formatMoney(order.salePriceLei)} lei` : "—"}
                  </TableCell>
                  <TableCell align="right" className="font-mono font-semibold max-sm:hidden">
                    <MarginCell order={order} />
                  </TableCell>
                  <TableCell className="max-sm:hidden">
                    <StatusBadge status={order.status} />
                  </TableCell>
                  {actionColumns > 0 ? (
                    <TableCell align="right">
                      <div className="flex flex-wrap items-start justify-end gap-1.5">
                        {showActions ? (
                          <>
                            <OrderStatusControl orderId={order.id} status={order.status} />
                            <ExternalOrderDialog
                              order={toFormValue(order)}
                              suppliers={suppliers}
                              triggerLabel="Editează"
                              triggerKind="row"
                            />
                          </>
                        ) : null}
                        {canDelete ? (
                          <OrderDeleteButton orderId={order.id} orderNumber={order.number} />
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-10 text-center text-[#52525b]" colSpan={actionColumns > 0 ? 10 : 9}>
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STATUS_TONES: Record<ExternalOrderStatus, BadgeTone> = {
  CERERE: "gray",
  OFERTAT: "amber",
  CONFIRMAT: "blue",
  RECEPTIONAT: "purple",
  LIVRAT: "green",
  ANULAT: "red",
};

function StatusBadge({ status }: { status: ExternalOrderStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
  );
}

function MarginCell({ order }: { order: ExternalOrderRow }) {
  const margin = orderMargin(order);
  if (margin == null) return <span className="font-normal text-[#71717a]">—</span>;
  return (
    <span className={margin < 0 ? "text-[#b91c1c]" : "text-[#166534]"}>
      {formatMoney(margin)} lei
    </span>
  );
}

/** Marja totală pe comandă: (vânzare − achiziție) × cantitate. */
function orderMargin(order: ExternalOrderRow): number | null {
  if (order.salePriceLei == null || order.supplierPriceLei == null) return null;
  return (order.salePriceLei - order.supplierPriceLei) * order.quantity;
}

function toFormValue(order: ExternalOrderRow): ExternalOrderFormValue {
  return {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone ?? "",
    productName: order.productName,
    productCode: order.productCode ?? "",
    quantity: order.quantity,
    supplierId: order.supplierId ?? "",
    supplierPriceLei: order.supplierPriceLei?.toString() ?? "",
    salePriceLei: order.salePriceLei?.toString() ?? "",
    offerValidUntil: order.offerValidUntil
      ? order.offerValidUntil.toISOString().slice(0, 10)
      : "",
    notes: order.notes ?? "",
  };
}


function TableHead({
  align = "left",
  children,
  className = "",
}: {
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-2.5 text-[13px] font-semibold text-[#52525b] ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

function TableCell({
  align = "left",
  children,
  className = "",
}: {
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ro-MD", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 0 }).format(value);
}

/** Doar ofertele încă neconfirmate pot fi „expirate"; după comandă prețul e bătut. */
function isExpiredOffer(status: ExternalOrderStatus, validUntil: Date) {
  return status === "OFERTAT" && validUntil.getTime() < Date.now();
}
