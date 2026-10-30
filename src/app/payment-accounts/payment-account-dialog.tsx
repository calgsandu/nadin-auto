"use client";

import { FileText, Package, Plus, Trash2, UserPlus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  DrawerCard,
  DrawerField,
  DrawerTotal,
  OperationDrawer,
  drawerDangerButton,
  drawerFormClassName,
  drawerSecondaryButton,
  focusFirstLineSearch,
  handleEnterNavigation,
  useDrawerAction,
} from "@/app/components/operation-drawer";
import { useDrawerDraft } from "@/app/components/use-drawer-draft";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import { PartnerFormDialog } from "@/app/partners/partner-form-dialog";
import { useOptimisticOptions } from "@/app/components/use-optimistic-options";
import {
  createPaymentAccountAction,
  type PaymentAccountActionState,
} from "@/app/payment-accounts/actions";
import { formatDateInputValue } from "@/lib/operations/date-input";
import { quantityAfterSelect } from "@/lib/operations/default-quantity";
import { calculatePaymentTotals } from "@/lib/payment-accounts/totals";

type CustomerOption = {
  id: string;
  name: string;
  idno: string | null;
  address: string | null;
};

type WarehouseOption = { id: string; name: string };
/** `productId`/`label` doar pentru ciornă: la recuperare se reface fișa produsului. */
type EditableLine = {
  id: number;
  productId: string;
  label: string;
  quantity: string;
  price: string;
};

const emptyLine = (id: number): EditableLine => ({
  id,
  productId: "",
  label: "",
  quantity: "",
  price: "",
});

const initialState: PaymentAccountActionState = { ok: false, message: "" };
const inputClassName =
  "field-control h-9 w-full rounded-md border border-[#e4e4e7] bg-white px-2.5 text-sm text-[#18181b] outline-none placeholder:text-[#71717a] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25";

export function PaymentAccountDialog({
  customers,
  warehouses,
}: {
  customers: CustomerOption[];
  warehouses: WarehouseOption[];
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  // „Client nou" deschide fișa de partener: contul de plată cere IDNO și adresă,
  // iar varianta veche (nume + două câmpuri libere) lăsa clientul pe jumătate.
  const [customerForm, setCustomerForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const { options: customerOptions, add: addCustomer } = useOptimisticOptions(customers);
  const [lines, setLines] = useState<EditableLine[]>([emptyLine(1)]);
  const nextLineId = useRef(2);

  function resetForm() {
    setCustomerId("");
    setLines([emptyLine(1)]);
    nextLineId.current = 2;
  }
  const draft = useDrawerDraft({
    kind: "payment-account",
    lines: { lines, customerId },
    setLines: (restored) => {
      nextLineId.current =
        restored.lines.reduce((max, line) => Math.max(max, line.id), 0) + 1;
      setLines(restored.lines);
      setCustomerId(restored.customerId);
    },
    reset: resetForm,
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(
    createPaymentAccountAction,
    initialState,
    () => {
      setOpen(false);
      setMounted(false);
      resetForm();
      draft.clear();
    },
  );
  const today = useMemo(() => formatDateInputValue(new Date()), []);
  const defaultDueDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return formatDateInputValue(date);
  }, []);
  const defaultWarehouse =
    warehouses.find((warehouse) => warehouse.name === "Pavilion 110A")?.id ??
    warehouses[0]?.id ??
    "";
  const selectedCustomer = customerOptions.find((customer) => customer.id === customerId);
  const totals = calculatePaymentTotals(
    lines.map((line) => ({
      quantity: Number(line.quantity) || 0,
      unitPriceGross: Number(line.price) || 0,
    })),
    0.2,
    true,
  );

  function addLine() {
    const id = nextLineId.current++;
    setLines((current) => [emptyLine(id), ...current]);
    focusFirstLineSearch();
  }

  function updateLine(id: number, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  return (
    <>
      <button
        className="button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-[#18181b] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#27272a]"
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        Emite cont de plată
      </button>

      {mounted ? (
        <OperationDrawer
          title="Cont de plată nou"
          icon={FileText}
          open={open}
          pending={pending}
          submitLabel="Emite contul"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
              <form
                ref={attachForm}
                onSubmit={onSubmit}
                className={drawerFormClassName}
                onKeyDown={(event) => handleEnterNavigation(event, addLine)}
              >
                <input name="idempotencyKey" type="hidden" value={draft.token} />
                <DrawerCard icon={FileText} title="Detalii">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
                  <Field label="Client">
                    <div className="flex gap-2">
                      <select
                        className={inputClassName}
                        name="partnerId"
                        required
                        value={customerId}
                        onChange={(event) => setCustomerId(event.currentTarget.value)}
                      >
                        <option disabled value="">Alege clientul</option>
                        {customerOptions.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}{!customer.idno || !customer.address ? " (date incomplete)" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label="Client nou"
                        className="button-secondary grid size-9 shrink-0 place-items-center rounded-md border border-[#e4e4e7] bg-white text-[#18181b] hover:bg-[#f4f4f5]"
                        title="Client nou"
                        type="button"
                        onClick={() => setCustomerForm(true)}
                      >
                        <UserPlus className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    {/* Fără IDNO și adresă contul nu se poate emite: spunem pe loc. */}
                    {selectedCustomer && (!selectedCustomer.idno || !selectedCustomer.address) ? (
                      <span className="text-xs font-medium text-[#b45309]">
                        Lipsește {!selectedCustomer.idno ? "IDNO-ul" : "adresa"} — completează fișa clientului.
                      </span>
                    ) : null}
                    <PartnerFormDialog
                      defaultKind="CUSTOMER"
                      open={customerForm}
                      onOpenChange={setCustomerForm}
                      onCreated={(partner) => {
                        addCustomer(partner);
                        setCustomerId(partner.id);
                      }}
                    />
                  </Field>
                  <Field label="Predat din">
                    <select className={inputClassName} defaultValue={defaultWarehouse} name="warehouseId" required>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Data emiterii">
                    <input className={inputClassName} defaultValue={today} name="issueDate" required type="date" />
                  </Field>
                  <Field label="Scadența">
                    <input className={inputClassName} defaultValue={defaultDueDate} name="dueDate" type="date" />
                  </Field>
                </div>
                </DrawerCard>

                <DrawerCard
                  lines
                  icon={Package}
                  title="Marfă"
                  action={
                    <button className={drawerSecondaryButton} type="button" onClick={addLine}>
                      <Plus className="size-4" aria-hidden="true" /> Produs
                    </button>
                  }
                >
                  <div className="grid gap-1.5">
                    {lines.map((line, index) => {
                      const calculated = totals.lines[index];
                      return (
                        <div
                          key={line.id}
                          className="motion-line-item grid gap-2 rounded-lg border border-[#ececef] bg-[#fafafa] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_5rem_8rem_8rem_2.25rem] md:items-start"
                        >
                          <div>
                            <p className="line-label mb-1 text-[13px] font-medium leading-5 text-[#52525b]">Produs</p>
                            <ProductSearchCombobox
                              showHint={false}
                              initialProduct={
                                line.productId ? { id: line.productId, label: line.label } : null
                              }
                              onSelect={(product) =>
                                updateLine(line.id, {
                                  productId: product.id,
                                  label: product.label,
                                  quantity: quantityAfterSelect(product.id),
                                  price: product.salePriceLei,
                                })
                              }
                              onClear={() =>
                                updateLine(line.id, { productId: "", label: "", quantity: "" })
                              }
                            />
                          </div>
                          <Field label="Cant.">
                            <input
                              className={inputClassName}
                              min={1}
                              name="quantity"
                              required
                              type="number"
                              value={line.quantity}
                              onChange={(event) => updateLine(line.id, { quantity: event.currentTarget.value })}
                            />
                          </Field>
                          <Field label="Preț cu TVA">
                            <input
                              className={inputClassName}
                              min="0.01"
                              name="unitPriceGross"
                              required
                              step="0.01"
                              type="number"
                              value={line.price}
                              onChange={(event) => updateLine(line.id, { price: event.currentTarget.value })}
                            />
                          </Field>
                          <Field label="Sumă">
                            <div className="flex h-9 items-center justify-end whitespace-nowrap px-1 text-sm font-semibold tabular-nums text-[#18181b]">
                              {money(calculated.gross)} lei
                            </div>
                          </Field>
                          <button
                            aria-label={`Șterge produsul ${index + 1}`}
                            className={drawerDangerButton}
                            disabled={lines.length === 1}
                            type="button"
                            onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </DrawerCard>

                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
                  <Field label="Mențiuni pe cont">
                    <textarea
                      className={`${inputClassName} min-h-14 resize-y py-2`}
                      name="notes"
                      placeholder="Termen de achitare, condiții de ridicare etc."
                    />
                  </Field>
                  <DrawerTotal total={money(totals.gross)} vat={money(totals.vat)} />
                </div>
              </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}

const Field = DrawerField;



const money = (value: number) => new Intl.NumberFormat("ro-MD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
