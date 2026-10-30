"use client";

import { useState } from "react";
import { Banknote, Package, Truck, UserRound } from "lucide-react";
import {
  createExternalOrderAction,
  updateExternalOrderAction,
  type ExternalOrderActionState,
} from "@/app/external-orders/actions";
import {
  DrawerCard,
  DrawerField,
  OperationDrawer,
  drawerFormClassName,
  handleEnterNavigation,
  useDrawerAction,
} from "@/app/components/operation-drawer";
import { SupplierPicker } from "@/app/partners/supplier-picker";

export type ExternalOrderFormValue = {
  id: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  productCode: string;
  quantity: number;
  supplierId: string;
  supplierPriceLei: string;
  salePriceLei: string;
  offerValidUntil: string;
  notes: string;
};

export type SupplierOption = { id: string; name: string };

type ExternalOrderDialogProps = {
  order?: ExternalOrderFormValue;
  suppliers: SupplierOption[];
  triggerLabel: string;
  triggerKind?: "primary" | "row";
};

const initialState: ExternalOrderActionState = { ok: false, message: "" };

export function ExternalOrderDialog({
  order,
  suppliers,
  triggerLabel,
  triggerKind = "primary",
}: ExternalOrderDialogProps) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const action = order ? updateExternalOrderAction : createExternalOrderAction;
  const [cost, setCost] = useState(order?.supplierPriceLei ?? "");
  const [sale, setSale] = useState(order?.salePriceLei ?? "");
  const [quantity, setQuantity] = useState(String(order?.quantity ?? 1));
  const qty = Number(quantity) || 1;
  const costValue = Number(cost.replace(",", "."));
  const saleValue = Number(sale.replace(",", "."));
  const margin = cost && sale && Number.isFinite(costValue) && Number.isFinite(saleValue) ? (saleValue - costValue) * qty : null;
  const { pending, onSubmit } = useDrawerAction(action, initialState, () => {
    setOpen(false);
    setMounted(false);
    // Formularul se remontează gol: și marja pornește de la zero.
    setCost(order?.supplierPriceLei ?? "");
    setSale(order?.salePriceLei ?? "");
    setQuantity(String(order?.quantity ?? 1));
  });

  return (
    <>
      <button
        className={
          triggerKind === "row"
            ? "button-secondary button-icon-edit inline-flex items-center gap-1.5 rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
            : "button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-[#18181b] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#27272a]"
        }
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        {triggerLabel}
      </button>

      {mounted ? (
        <OperationDrawer
          title={order ? "Editează comanda" : "Comandă nouă la furnizor"}
          icon={Truck}
          open={open}
          pending={pending}
          submitLabel={order ? "Salvează" : "Creează comanda"}
          onClose={() => setOpen(false)}
        >
              <form onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event)}>
                {order ? <input name="orderId" type="hidden" value={order.id} /> : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <DrawerCard icon={UserRound} title="Clientul">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Nume">
                        <input
                          className={inputClassName}
                          name="customerName"
                          defaultValue={order?.customerName ?? ""}
                          placeholder="Numele clientului"
                          required
                        />
                      </Field>
                      <Field label="Telefon">
                        <input
                          className={inputClassName}
                          name="customerPhone"
                          defaultValue={order?.customerPhone ?? ""}
                          inputMode="tel"
                          placeholder="ex. 060 123 456"
                        />
                      </Field>
                    </div>
                  </DrawerCard>

                  <DrawerCard icon={Package} title="Piesa">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_5rem]">
                      <Field label="Ce cere">
                        <input
                          className={inputClassName}
                          name="productName"
                          defaultValue={order?.productName ?? ""}
                          placeholder="ex. Far stânga Dacia Logan 2018"
                          required
                        />
                      </Field>
                      <Field label="Cod">
                        <input
                          className={`${inputClassName} font-mono`}
                          name="productCode"
                          defaultValue={order?.productCode ?? ""}
                          placeholder="opțional"
                        />
                      </Field>
                      <Field label="Cant.">
                        <input
                          className={inputClassName}
                          name="quantity"
                          defaultValue={order?.quantity ?? 1}
                          type="number"
                          min={1}
                          step={1}
                          required
                          onChange={(event) => setQuantity(event.currentTarget.value)}
                        />
                      </Field>
                    </div>
                  </DrawerCard>
                </div>

                <DrawerCard
                  icon={Banknote}
                  title="Furnizor și preț"
                  action={
                    // Marja pe loc: vezi dacă merită comanda înainte s-o confirmi.
                    margin !== null ? (
                      <p className={`text-sm font-semibold tabular-nums ${margin < 0 ? "text-[#b91c1c]" : "text-[#166534]"}`}>
                        marjă {formatLei(margin)} lei
                        {qty > 1 ? <span className="font-normal text-[#52525b]"> ({formatLei(margin / qty)} / buc)</span> : null}
                      </p>
                    ) : null
                  }
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Furnizor">
                      <SupplierPicker
                        className={inputClassName}
                        defaultValue={order?.supplierId ?? ""}
                        name="supplierId"
                        noneLabel="— de stabilit —"
                        suppliers={suppliers}
                      />
                    </Field>
                    <Field label="Cost / buc (lei)">
                      <input
                        className={inputClassName}
                        name="supplierPriceLei"
                        defaultValue={order?.supplierPriceLei ?? ""}
                        inputMode="decimal"
                        placeholder="de la furnizor"
                        onChange={(event) => setCost(event.currentTarget.value)}
                      />
                    </Field>
                    <Field label="Preț client / buc (lei)">
                      <input
                        className={inputClassName}
                        name="salePriceLei"
                        defaultValue={order?.salePriceLei ?? ""}
                        inputMode="decimal"
                        placeholder="pentru client"
                        onChange={(event) => setSale(event.currentTarget.value)}
                      />
                    </Field>
                    <Field label="Ofertă valabilă până la">
                      <input
                        className={inputClassName}
                        name="offerValidUntil"
                        defaultValue={order?.offerValidUntil ?? ""}
                        type="date"
                      />
                    </Field>
                  </div>
                </DrawerCard>

                <Field label="Note">
                  <textarea
                    className={`${inputClassName} min-h-14 resize-y py-2`}
                    name="notes"
                    defaultValue={order?.notes ?? ""}
                    placeholder="Termen de livrare, condiții, observații..."
                  />
                </Field>
              </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}



const Field = DrawerField;
const formatLei = (value: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(value);

const inputClassName =
  "field-control h-9 w-full rounded-md border border-[#e4e4e7] bg-white px-2.5 text-sm outline-none placeholder:text-[#71717a] disabled:bg-[#f1f1f3]";
