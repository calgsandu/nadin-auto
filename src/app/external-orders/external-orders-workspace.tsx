import type { ReactNode } from "react";
import {
  ExternalOrderDialog,
  type ExternalOrderFormValue,
} from "@/app/external-orders/external-order-dialog";
import {
  OrderDeleteButton,
  OrderStatusControl,
} from "@/app/external-orders/order-row-actions";
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
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Comenzi active" value={formatNumber(data.active.length)} />
        <Metric label="Livrate" value={formatNumber(delivered.length)} />
        <Metric label="Marjă totală (livrate)" value={`${formatMoney(deliveredMargin)} lei`} />
      </div>

      <div className="motion-card flex flex-col gap-3 rounded-xl border border-[#e8e7e3] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#1b1a17]">Aprovizionare la comandă</h2>
          <p className="text-sm text-[#6f6b63]">
            Clientul cere piesa → suni furnizorul → confirmi → aduci → livrezi. Catalogul propriu nu este afectat.
          </p>
        </div>
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
    <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
      <div className="border-b border-[#e8e7e3] px-4 py-3">
        <h2 className="font-semibold text-[#1b1a17]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
            <tr>
              <TableHead>Nr.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Piesa</TableHead>
              <TableHead>Furnizor</TableHead>
              <TableHead align="right">Cant.</TableHead>
              <TableHead align="right">Cost / buc</TableHead>
              <TableHead align="right">Vânzare / buc</TableHead>
              <TableHead align="right">Marjă</TableHead>
              <TableHead>Status</TableHead>
              {actionColumns > 0 ? <TableHead align="right">Acțiuni</TableHead> : null}
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map((order) => (
                <tr key={order.id} className="motion-table-row border-t border-[#efeeeb] align-top hover:bg-[#f6f6f4]">
                  <TableCell className="font-mono text-xs font-semibold">#{order.number}</TableCell>
                  <TableCell>
                    <p className="font-medium text-[#1b1a17]">{order.customerName}</p>
                    {order.customerPhone ? (
                      <p className="mt-0.5 font-mono text-xs text-[#6f6b63]">{order.customerPhone}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-[#1b1a17]">{order.productName}</p>
                    {order.productCode ? (
                      <p className="mt-0.5 font-mono text-xs text-[#6f6b63]">{order.productCode}</p>
                    ) : null}
                    {order.notes ? (
                      <p className="mt-0.5 text-xs text-[#6f6b63]">{order.notes}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {order.supplierName ?? <span className="text-[#98948b]">de stabilit</span>}
                    {order.offerValidUntil ? (
                      <p className="mt-0.5 text-xs text-[#6f6b63]">
                        Ofertă până la {formatDate(order.offerValidUntil)}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell align="right" className="font-mono">{formatNumber(order.quantity)}</TableCell>
                  <TableCell align="right" className="font-mono">
                    {order.supplierPriceLei != null ? `${formatMoney(order.supplierPriceLei)} lei` : "—"}
                  </TableCell>
                  <TableCell align="right" className="font-mono font-semibold">
                    {order.salePriceLei != null ? `${formatMoney(order.salePriceLei)} lei` : "—"}
                  </TableCell>
                  <TableCell align="right" className="font-mono font-semibold">
                    <MarginCell order={order} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  {actionColumns > 0 ? (
                    <TableCell align="right">
                      <div className="grid justify-items-end gap-2">
                        {showActions ? (
                          <>
                            <ExternalOrderDialog
                              order={toFormValue(order)}
                              suppliers={suppliers}
                              triggerLabel="Editează"
                              triggerKind="row"
                            />
                            <OrderStatusControl orderId={order.id} status={order.status} />
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
                <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={actionColumns > 0 ? 10 : 9}>
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

const STATUS_STYLES: Record<ExternalOrderStatus, string> = {
  CERERE: "bg-[#f1f0ed] text-[#6f6b63]",
  OFERTAT: "bg-[#fef3c7] text-[#92400e]",
  CONFIRMAT: "bg-[#dbebfe] text-[#175cd3]",
  RECEPTIONAT: "bg-[#ede9fe] text-[#6d28d9]",
  LIVRAT: "bg-[#dcfce7] text-[#166534]",
  ANULAT: "bg-[#fee2e2] text-[#b91c1c]",
};

function StatusBadge({ status }: { status: ExternalOrderStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function MarginCell({ order }: { order: ExternalOrderRow }) {
  const margin = orderMargin(order);
  if (margin == null) return <span className="font-normal text-[#98948b]">—</span>;
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="motion-card rounded-xl border border-[#e8e7e3] bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98948b]">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums text-[#1b1a17]">{value}</p>
    </div>
  );
}

function TableHead({
  align = "left",
  children,
}: {
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98948b] ${
        align === "right" ? "text-right" : "text-left"
      }`}
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
