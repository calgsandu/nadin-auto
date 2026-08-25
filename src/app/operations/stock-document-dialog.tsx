"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  createReceiptAction,
  createSaleAction,
  createTransferAction,
  type OperationActionState,
} from "@/app/operations/actions";
import {
  DrawerField,
  DrawerSubmit,
  OperationDrawer,
  focusFirstLineSearch,
  handleEnterNavigation,
  useDrawerAction,
  drawerFormClassName,
  drawerDangerButton,
  drawerInputClassName,
  drawerSecondaryButton,
} from "@/app/components/operation-drawer";
import { useDrawerDraft } from "@/app/components/use-drawer-draft";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import { SupplierPicker } from "@/app/partners/supplier-picker";
import { PartnerFormDialog } from "@/app/partners/partner-form-dialog";
import { useOptimisticOptions } from "@/app/components/use-optimistic-options";
import { formatDateInputValue } from "@/lib/operations/date-input";
import { PRICE_CATEGORIES, applyDiscount } from "@/lib/operations/sale-pricing";
import { DEFAULT_QUANTITY } from "@/lib/operations/default-quantity";

export type WarehouseOption = {
  id: string;
  name: string;
};

export type SupplierOption = {
  id: string;
  name: string;
  /** Doar clienți: datoria curentă („Долг"), pozitivă = ne datorează. */
  balanceLei?: number;
};

type StockDocumentDialogProps = {
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
};

const initialState: OperationActionState = {
  ok: false,
  message: "",
};

/**
 * `label` nu se trimite la server: e acolo ca să se poată reface fișa
 * produsului când ciorna e recuperată (combobox-ul primește `initialProduct`).
 */
type ReceiptLine = {
  id: number;
  productId: string;
  label: string;
  qty: string;
  price: string;
  oldCost: string;
};

const emptyReceiptLine = (id: number): ReceiptLine => ({
  id,
  productId: "",
  label: "",
  qty: DEFAULT_QUANTITY,
  price: "",
  oldCost: "",
});

/** Rândurile restaurate își păstrează id-urile — următorul rând nou trece peste ele. */
function nextIdAfter(lines: { id: number }[]) {
  return lines.reduce((max, line) => Math.max(max, line.id), 0) + 1;
}

function initialProductOf(line: { productId: string; label: string }) {
  return line.productId ? { id: line.productId, label: line.label } : null;
}

export function StockDocumentDialog({ warehouses, suppliers }: StockDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<ReceiptLine[]>([emptyReceiptLine(1)]);
  // Rând nou cu id nou = căutările de produs se remontează golite.
  function resetLines() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines([emptyReceiptLine(id)]);
  }
  const draft = useDrawerDraft({
    kind: "receipt",
    lines,
    setLines: (restored) => {
      nextLineId.current = nextIdAfter(restored);
      setLines(restored);
    },
    reset: resetLines,
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(
    createReceiptAction,
    initialState,
    () => {
      resetLines();
      draft.clear();
    },
  );
  const defaultWarehouse = warehouses[0]?.id ?? "";
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  function addLine() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines((current) => [emptyReceiptLine(id), ...current]);
    focusFirstLineSearch();
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function moveLine(id: number, direction: -1 | 1) {
    setLines((current) => {
      const index = current.findIndex((line) => line.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setLineField(id: number, field: "qty" | "price", value: string) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  /** Prețul recepționat pornește de la costul curent și, dacă diferă, îl înlocuiește. */
  function selectReceiptProduct(id: number, productId: string, cost: string, label: string) {
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, productId, label, price: cost, oldCost: cost } : line,
      ),
    );
  }

  const valoare = lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const tvaTotal = Math.round((valoare / 6) * 100) / 100;
  const faraTva = Math.round((valoare - tvaTotal) * 100) / 100;
  const money = (v: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(v);

  function openDrawer() {
    setMounted(true);
    setOpen(true);
  }

  return (
    <>
      <button
        className={primaryButtonClassName}
        type="button"
        onClick={openDrawer}
      >
        Adaugă recepție
      </button>

      {mounted ? (
        <OperationDrawer
          title="Recepție marfă"
          open={open}
          pending={pending}
          submitLabel="Salvează recepția"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
              <input name="idempotencyKey" type="hidden" value={draft.token} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Data documentului">
                  <input
                    className={inputClassName}
                    defaultValue={today}
                    name="documentDate"
                    type="date"
                  />
                </Field>
                <Field label="Locație">
                  <select
                    className={inputClassName}
                    defaultValue={defaultWarehouse}
                    name="warehouseId"
                    required
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Serie / nr. factură">
                  <input className={inputClassName} name="externalNumber" placeholder="ex. AA 0123456" />
                </Field>
                <Field label="Furnizor">
                  <SupplierPicker
                    className={inputClassName}
                    name="partnerId"
                    suppliers={suppliers}
                  />
                </Field>
              </div>

              <section data-drawer-lines className="overflow-visible rounded-xl border border-[#e8e7e3] bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#e8e7e3] bg-[#f6f6f4] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#1b1a17]">Produse recepționate</h3>
                    <p className="text-xs text-[#6f6b63]">
                      Toate pozițiile vor fi salvate într-un singur document.
                    </p>
                  </div>
                  <button
                    className={secondaryButtonClassName}
                    type="button"
                    onClick={addLine}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Adaugă produs
                  </button>
                </div>

                <div className="grid gap-3 p-3">
                  {lines.map((line, index) => {
                    const lineVal = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    const lineTva = lineVal / 6;
                    const lineNet = lineVal - lineTva;
                    return (
                    <div
                      key={line.id}
                      className="motion-line-item grid gap-3 rounded-md border border-[#efeeeb] bg-[#ffffff] p-3 md:grid-cols-[minmax(0,1fr)_5rem_9rem_12rem_5.5rem] md:items-start"
                    >
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-[#6f6b63]">
                          Produs {index + 1}
                        </p>
                        <ProductSearchCombobox
                          showHint={false}
                          initialProduct={initialProductOf(line)}
                          excludedProductIds={lines
                            .filter((item) => item.id !== line.id)
                            .map((item) => item.productId)}
                          onSelect={(p) =>
                            selectReceiptProduct(line.id, p.id, p.defaultCostLei, p.label)
                          }
                          onClear={() => selectReceiptProduct(line.id, "", "", "")}
                        />
                      </div>
                      <Field label="Cantitate">
                        <input
                          className={inputClassName}
                          inputMode="numeric"
                          min={1}
                          name="quantity"
                          required
                          type="number"
                          value={line.qty}
                          onChange={(e) => setLineField(line.id, "qty", e.currentTarget.value)}
                        />
                      </Field>
                      <Field label="Cost lei / bucată">
                        <input
                          className={inputClassName}
                          inputMode="decimal"
                          min={0}
                          name="unitCostLei"
                          placeholder="auto"
                          step="0.01"
                          type="number"
                          value={line.price}
                          onChange={(e) => setLineField(line.id, "price", e.currentTarget.value)}
                        />
                        {line.oldCost && line.price && line.price !== line.oldCost ? (
                          <span className="font-mono text-[11px] font-semibold text-[#b45309]">
                            cost curent {money(Number(line.oldCost))} → se actualizează
                          </span>
                        ) : line.oldCost ? (
                          <span className="font-mono text-[11px] text-[#6f6b63]">
                            cost curent {money(Number(line.oldCost))}
                          </span>
                        ) : null}
                      </Field>
                      <Field label="Valoare / TVA / fără TVA">
                        <div className="flex h-11 flex-col justify-center rounded-md border border-[#efeeeb] bg-[#f6f6f4] px-3 font-mono text-xs leading-tight text-[#1b1a17]">
                          <span className="font-semibold">{money(lineVal)} lei</span>
                          <span className="text-[#6f6b63]">TVA {money(lineTva)}, net {money(lineNet)}</span>
                        </div>
                      </Field>
                      <LineControls
                        index={index}
                        total={lines.length}
                        onMove={(direction) => moveLine(line.id, direction)}
                        onRemove={() => removeLine(line.id)}
                      />
                    </div>
                    );
                  })}
                </div>
              </section>

              <div className="ml-auto w-full max-w-xs rounded-xl border border-[#e8e7e3] bg-white p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-[#6f6b63]">TVA plătit (÷6)</span>
                  <span className="font-mono font-semibold">{money(tvaTotal)} lei</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#6f6b63]">Fără TVA</span>
                  <span className="font-mono font-semibold">{money(faraTva)} lei</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-[#efeeeb] pt-2 text-base">
                  <span className="font-semibold text-[#1b1a17]">Total (cu TVA)</span>
                  <span className="font-mono font-bold text-[#1b1a17]">{money(valoare)} lei</span>
                </div>
              </div>

              <Field label="Notițe">
                <textarea
                  className={`${inputClassName} min-h-24 resize-y py-3`}
                  name="notes"
                  placeholder="factură, transport, explicații"
                />
              </Field>


              <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5">
                <button
                  className={`${secondaryButtonClassName} px-4 py-2.5`}
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Anulează
                </button>
                <SubmitButton label="Salvează recepția" pending={pending} />
              </div>
            </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}

export function StockTransferDialog({ warehouses }: { warehouses: WarehouseOption[] }) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<{ id: number; productId: string; label: string }[]>([
    { id: 1, productId: "", label: "" },
  ]);
  function resetLines() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines([{ id, productId: "", label: "" }]);
  }
  const draft = useDrawerDraft({
    kind: "transfer",
    lines,
    setLines: (restored) => {
      nextLineId.current = nextIdAfter(restored);
      setLines(restored);
    },
    reset: resetLines,
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(
    createTransferAction,
    initialState,
    () => {
      resetLines();
      draft.clear();
    },
  );
  const defaultSourceWarehouse = warehouses[0]?.id ?? "";
  const defaultDestinationWarehouse =
    warehouses.find((warehouse) => warehouse.id !== defaultSourceWarehouse)?.id ?? "";
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  function addLine() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines((current) => [{ id, productId: "", label: "" }, ...current]);
    focusFirstLineSearch();
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function setTransferProduct(id: number, productId: string, label: string) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, productId, label } : line)),
    );
  }

  function openDrawer() {
    setMounted(true);
    setOpen(true);
  }

  return (
    <>
      <button
        className={primaryButtonClassName}
        type="button"
        onClick={openDrawer}
      >
        Adaugă transfer
      </button>

      {mounted ? (
        <OperationDrawer
          title="Transfer între locații"
          open={open}
          pending={pending}
          submitLabel="Salvează transferul"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
              <input name="idempotencyKey" type="hidden" value={draft.token} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Field label="Data transferului">
                  <input
                    className={inputClassName}
                    defaultValue={today}
                    name="documentDate"
                    type="date"
                  />
                </Field>
                <Field label="Din locația">
                  <select
                    className={inputClassName}
                    defaultValue={defaultSourceWarehouse}
                    name="sourceWarehouseId"
                    required
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="În locația">
                  <select
                    className={inputClassName}
                    defaultValue={defaultDestinationWarehouse}
                    name="destinationWarehouseId"
                    required
                  >
                    <option value="">Alege destinația</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <section data-drawer-lines className="overflow-visible rounded-xl border border-[#e8e7e3] bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#e8e7e3] bg-[#f6f6f4] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#1b1a17]">Produse transferate</h3>
                    <p className="text-xs text-[#6f6b63]">
                      Toate pozițiile vor fi mutate în aceeași operațiune.
                    </p>
                  </div>
                  <button
                    className={secondaryButtonClassName}
                    type="button"
                    onClick={addLine}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Adaugă produs
                  </button>
                </div>

                <div className="grid gap-3 p-3">
                  {lines.map((line, index) => (
                    <div
                      key={line.id}
                      className="motion-line-item grid gap-3 rounded-md border border-[#efeeeb] bg-[#ffffff] p-3 md:grid-cols-[minmax(0,1fr)_10rem_2.75rem] md:items-start"
                    >
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-[#6f6b63]">
                          Produs {index + 1}
                        </p>
                        <ProductSearchCombobox
                          showHint={false}
                          initialProduct={initialProductOf(line)}
                          excludedProductIds={lines
                            .filter((item) => item.id !== line.id)
                            .map((item) => item.productId)}
                          onSelect={(product) =>
                            setTransferProduct(line.id, product.id, product.label)
                          }
                          onClear={() => setTransferProduct(line.id, "", "")}
                        />
                      </div>
                      <Field label="Cantitate">
                        <input
                          className={inputClassName}
                          defaultValue={DEFAULT_QUANTITY}
                          inputMode="numeric"
                          min={1}
                          name="quantity"
                          required
                          type="number"
                        />
                      </Field>
                      <button
                        aria-label={`Șterge produsul ${index + 1}`}
                        className={dangerButtonClassName}
                        disabled={lines.length === 1}
                        type="button"
                        onClick={() => removeLine(line.id)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <Field label="Notițe">
                <textarea
                  className={`${inputClassName} min-h-24 resize-y py-3`}
                  name="notes"
                  placeholder="motiv, solicitare, responsabil"
                />
              </Field>


              <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5">
                <button
                  className={`${secondaryButtonClassName} px-4 py-2.5`}
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Anulează
                </button>
                <SubmitButton label="Salvează transferul" pending={pending} />
              </div>
            </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}

type SaleLineState = {
  id: number;
  /** Linie externă = piesă de la furnizor, în afara catalogului propriu. */
  external: boolean;
  productId: string;
  /** Doar pentru ciornă: reface fișa produsului la recuperare. */
  label: string;
  qty: string;
  price: string;
  name: string;
  code: string;
  supplierId: string;
  cost: string;
  /** Prețul din fișa produsului („Цена исх.") — baza pentru discount. */
  listPrice: string;
  /** Costul de achiziție („Себ.ед."); gol pentru rolurile fără drept la costuri. */
  unitCost: string;
};

function emptySaleLine(id: number, external = false): SaleLineState {
  return {
    id,
    external,
    productId: "",
    label: "",
    qty: DEFAULT_QUANTITY,
    price: "",
    name: "",
    code: "",
    supplierId: "",
    cost: "",
    listPrice: "",
    unitCost: "",
  };
}

export function StockSaleDialog({
  warehouses,
  customers = [],
  suppliers = [],
}: {
  warehouses: WarehouseOption[];
  customers?: SupplierOption[];
  suppliers?: SupplierOption[];
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const [newClient, setNewClient] = useState(false);
  // „Client nou" scrie doar numele, iar partenerul apare mai târziu cu „(date
  // incomplete)" la contul de plată. De aici se deschide fișa întreagă.
  const [customerForm, setCustomerForm] = useState(false);
  const [customerFormName, setCustomerFormName] = useState("");
  const newCustomerRef = useRef<HTMLInputElement>(null);
  // Clientul creat din fișa completă intră în listă fără să aștepte pagina.
  const { options: customerOptions, add: addCustomer } = useOptimisticOptions(customers);
  const [discount, setDiscount] = useState("0");
  const [customerId, setCustomerId] = useState("");
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<SaleLineState[]>([emptySaleLine(1)]);
  function resetForm() {
    setNewClient(false);
    setDiscount("0");
    setCustomerId("");
    nextLineId.current = 2;
    setLines([emptySaleLine(1)]);
  }
  // Discountul, clientul și linia externă sunt state React (nu câmpuri
  // necontrolate): intră în ciornă cu tot cu linii, altfel s-ar pierde.
  const draft = useDrawerDraft({
    kind: "sale",
    lines: { lines, discount, customerId, newClient },
    setLines: (restored) => {
      nextLineId.current = nextIdAfter(restored.lines);
      setLines(restored.lines);
      setDiscount(restored.discount);
      setCustomerId(restored.customerId);
      setNewClient(restored.newClient);
    },
    reset: resetForm,
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(createSaleAction, initialState, () => {
    setOpen(false);
    setMounted(false);
    resetForm();
    draft.clear();
  });
  const defaultWarehouse =
    warehouses.find((warehouse) => warehouse.name === "Pavilion 110A")?.id ??
    warehouses[0]?.id ??
    "";
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  function addLine(external = false) {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines((current) => [emptySaleLine(id, external), ...current]);
    if (!external) focusFirstLineSearch();
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function setLineField(
    id: number,
    field: "qty" | "price" | "name" | "code" | "supplierId" | "cost",
    value: string,
  ) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  function selectProduct(
    id: number,
    product: { id: string; label: string; salePriceLei: string; defaultCostLei: string },
  ) {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              productId: product.id,
              label: product.label,
              listPrice: product.salePriceLei,
              unitCost: product.defaultCostLei,
              price: applyDiscount(product.salePriceLei, discount) || product.salePriceLei,
            }
          : line,
      ),
    );
  }

  /** Discountul rescrie prețurile liniilor de catalog pornind de la prețul de listă. */
  function changeDiscount(value: string) {
    setDiscount(value);
    setLines((current) =>
      current.map((line) =>
        line.external || !line.listPrice
          ? line
          : { ...line, price: applyDiscount(line.listPrice, value) },
      ),
    );
  }

  function moveLine(id: number, direction: -1 | 1) {
    setLines((current) => {
      const index = current.findIndex((line) => line.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function clearProduct(id: number) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, productId: "", label: "" } : line)),
    );
  }

  // Prices are VAT-inclusive (gross). TVA = valoare ÷ 6; fără TVA = valoare − TVA.
  const valoare = lines.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0,
  );
  const tvaTotal = Math.round((valoare / 6) * 100) / 100;
  const faraTva = Math.round((valoare - tvaTotal) * 100) / 100;
  const money = (v: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(v);
  const selectedCustomerDebt =
    customerOptions.find((customer) => customer.id === customerId)?.balanceLei ?? 0;

  function openDrawer() {
    setMounted(true);
    setOpen(true);
  }

  return (
    <>
      <button className={primaryButtonClassName} type="button" onClick={openDrawer}>
        Adaugă vânzare
      </button>
      {mounted ? (
        <OperationDrawer
          title="Vânzare marfă"
          open={open}
          pending={pending}
          submitLabel="Salvează vânzarea"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
              <input name="idempotencyKey" type="hidden" value={draft.token} />
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Data vânzării">
                  <input className={inputClassName} defaultValue={today} name="documentDate" type="date" />
                </Field>
                <Field label="Vândut din locația">
                  <select className={inputClassName} defaultValue={defaultWarehouse} name="warehouseId" required>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Client (pentru factură)">
                  <div className="flex gap-2">
                    {newClient ? (
                      <input
                        autoFocus
                        className={inputClassName}
                        name="newCustomerName"
                        placeholder="nume client nou"
                        ref={newCustomerRef}
                        required
                      />
                    ) : (
                      <select
                        className={inputClassName}
                        name="partnerId"
                        value={customerId}
                        onChange={(event) => setCustomerId(event.currentTarget.value)}
                      >
                        <option value="">Consumator final</option>
                        {customerOptions.map((customer) => (
                          <option key={customer.id} value={customer.id}>{customer.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      className={`${secondaryButtonClassName} shrink-0`}
                      type="button"
                      onClick={() => setNewClient((current) => !current)}
                    >
                      {newClient ? "Alege din listă" : "Client nou"}
                    </button>
                    {newClient ? (
                      <button
                        className={`${secondaryButtonClassName} shrink-0`}
                        type="button"
                        onClick={() => {
                          // Numele tastat deja trece în fișă, ca să nu-l scrie de două ori.
                          setCustomerFormName(newCustomerRef.current?.value ?? "");
                          setCustomerForm(true);
                        }}
                      >
                        Fișă completă
                      </button>
                    ) : null}
                  </div>

                  <PartnerFormDialog
                    defaultKind="CUSTOMER"
                    initialName={customerFormName}
                    open={customerForm}
                    onOpenChange={setCustomerForm}
                    onCreated={(partner) => {
                      addCustomer(partner);
                      setCustomerId(partner.id);
                      // Clientul are acum fișă: inputul rapid n-ar face decât
                      // să creeze un al doilea partener cu același nume.
                      setNewClient(false);
                    }}
                  />
                  {selectedCustomerDebt > 0 ? (
                    <span className="font-mono text-[11px] font-semibold text-[#b91c1c]">
                      Datorie curentă: {money(selectedCustomerDebt)} lei
                    </span>
                  ) : null}
                </Field>
                <Field label="Bătut în casa de marcat?">
                  <select
                    className={inputClassName}
                    defaultValue=""
                    name="cashRegistered"
                    required
                  >
                    <option value="" disabled>Alege Da sau Nu</option>
                    <option value="yes">Da</option>
                    <option value="no">Nu</option>
                  </select>
                </Field>
                <Field label="Metoda de plată">
                  <select
                    className={inputClassName}
                    defaultValue=""
                    name="paymentMethod"
                    required
                  >
                    <option value="" disabled>Alege metoda de plată</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="credit">Pe datorie</option>
                    <option value="transfer">Transfer bancar</option>
                  </select>
                </Field>
                <Field label="Serie / nr. factură">
                  <input className={inputClassName} name="externalNumber" placeholder="ex. AA 0123456" />
                </Field>
                <Field label="Categorie de preț">
                  <select
                    className={inputClassName}
                    value={PRICE_CATEGORIES.some((c) => c.value === discount) ? discount : "custom"}
                    onChange={(event) => {
                      if (event.currentTarget.value !== "custom") changeDiscount(event.currentTarget.value);
                    }}
                  >
                    {PRICE_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                    <option value="custom">Discount personalizat</option>
                  </select>
                </Field>
                <Field label="Discount (%)">
                  <input
                    className={inputClassName}
                    inputMode="decimal"
                    max={100}
                    min={0}
                    name="discountPercent"
                    step="0.01"
                    type="number"
                    value={discount}
                    onChange={(event) => changeDiscount(event.currentTarget.value)}
                  />
                </Field>
              </div>
              <section data-drawer-lines className="overflow-visible rounded-xl border border-[#e8e7e3] bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#e8e7e3] bg-[#f6f6f4] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#1b1a17]">Produse vândute</h3>
                    <p className="text-xs text-[#6f6b63]">Vânzările din 110A intră automat în lista De adus.</p>
                  </div>
                  <div className="flex gap-2">
                    <button className={secondaryButtonClassName} type="button" onClick={() => addLine(false)}>
                      <Plus className="size-4" aria-hidden="true" /> Adaugă produs
                    </button>
                    <button className={secondaryButtonClassName} type="button" onClick={() => addLine(true)}>
                      <Plus className="size-4" aria-hidden="true" /> Piesă externă
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 p-3">
                  {lines.map((line, index) => {
                    const lineVal = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    const lineTva = lineVal / 6;
                    const lineNet = lineVal - lineTva;
                    if (line.external) {
                      const marja = ((Number(line.price) || 0) - (Number(line.cost) || 0)) * (Number(line.qty) || 0);
                      return (
                        <div key={line.id} className="motion-line-item grid gap-3 rounded-md border border-[#dbebfe] bg-[#ffffff] p-3 md:grid-cols-[minmax(0,1fr)_7rem_10rem_5rem_7rem_8rem_5.5rem] md:items-start">
                          <div>
                            <p className="mb-1.5 text-xs font-semibold text-[#175cd3]">
                              Piesă externă {index + 1} — de la furnizor, nu intră în catalog/stoc
                            </p>
                            <input name="productId" type="hidden" value="" />
                            <input
                              className={inputClassName}
                              name="externalName"
                              placeholder="denumirea piesei (ex. Aripă față stânga Sprinter)"
                              required
                              value={line.name}
                              onChange={(e) => setLineField(line.id, "name", e.currentTarget.value)}
                            />
                          </div>
                          <Field label="Cod piesă">
                            <input
                              className={inputClassName}
                              name="externalCode"
                              placeholder="ex. 506502"
                              required
                              value={line.code}
                              onChange={(e) => setLineField(line.id, "code", e.currentTarget.value)}
                            />
                          </Field>
                          <Field label="Furnizor">
                            <SupplierPicker
                              className={inputClassName}
                              name="externalSupplierId"
                              noneLabel="Fără furnizor"
                              suppliers={suppliers}
                              value={line.supplierId}
                              onChange={(supplierId) => setLineField(line.id, "supplierId", supplierId)}
                            />
                          </Field>
                          <Field label="Cantitate">
                            <input
                              className={inputClassName}
                              inputMode="numeric"
                              min={1}
                              name="quantity"
                              required
                              type="number"
                              value={line.qty}
                              onChange={(e) => setLineField(line.id, "qty", e.currentTarget.value)}
                            />
                          </Field>
                          <Field label="Cost lei / buc">
                            <input
                              className={inputClassName}
                              inputMode="decimal"
                              min={0}
                              name="externalCostLei"
                              placeholder="achiziție"
                              step="0.01"
                              type="number"
                              value={line.cost}
                              onChange={(e) => setLineField(line.id, "cost", e.currentTarget.value)}
                            />
                          </Field>
                          <Field label="Preț lei / buc">
                            <input
                              className={inputClassName}
                              inputMode="decimal"
                              min={0}
                              name="unitPriceEuro"
                              required
                              step="0.01"
                              type="number"
                              value={line.price}
                              onChange={(e) => setLineField(line.id, "price", e.currentTarget.value)}
                            />
                            {line.cost ? (
                              <span className="font-mono text-[11px] text-[#6f6b63]">
                                marjă {money(marja)} lei
                              </span>
                            ) : null}
                          </Field>
                          <LineControls
                            index={index}
                            total={lines.length}
                            onMove={(direction) => moveLine(line.id, direction)}
                            onRemove={() => removeLine(line.id)}
                          />
                        </div>
                      );
                    }
                    return (
                    <div key={line.id} className="motion-line-item grid gap-3 rounded-md border border-[#efeeeb] bg-[#ffffff] p-3 md:grid-cols-[minmax(0,1fr)_5rem_9rem_12rem_5.5rem] md:items-start">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-[#6f6b63]">Produs {index + 1}</p>
                        <input name="externalName" type="hidden" value="" />
                        <input name="externalCode" type="hidden" value="" />
                        <input name="externalSupplierId" type="hidden" value="" />
                        <input name="externalCostLei" type="hidden" value="" />
                        <ProductSearchCombobox
                          excludedProductIds={lines.filter((item) => item.id !== line.id).map((item) => item.productId)}
                          initialProduct={initialProductOf(line)}
                          showHint={false}
                          onClear={() => clearProduct(line.id)}
                          onSelect={(p) => selectProduct(line.id, p)}
                        />
                      </div>
                      <Field label="Cantitate">
                        <input
                          className={inputClassName}
                          inputMode="numeric"
                          min={1}
                          name="quantity"
                          required
                          type="number"
                          value={line.qty}
                          onChange={(e) => setLineField(line.id, "qty", e.currentTarget.value)}
                        />
                      </Field>
                      <Field label="Preț lei / bucată">
                        <input
                          className={inputClassName}
                          inputMode="decimal"
                          min={0}
                          name="unitPriceEuro"
                          placeholder="auto"
                          step="0.01"
                          type="number"
                          value={line.price}
                          onChange={(e) => setLineField(line.id, "price", e.currentTarget.value)}
                        />
                        {line.listPrice ? (
                          <span className="font-mono text-[11px] text-[#6f6b63]">
                            listă {money(Number(line.listPrice))}
                            {line.unitCost ? `, cost ${money(Number(line.unitCost))}` : ""}
                            {line.unitCost && Number(line.price) > 0
                              ? `, marjă ${Math.round(((Number(line.price) - Number(line.unitCost)) / Number(line.price)) * 100)}%`
                              : ""}
                          </span>
                        ) : null}
                      </Field>
                      <Field label="Valoare / TVA / fără TVA">
                        <div className="flex h-11 flex-col justify-center rounded-md border border-[#efeeeb] bg-[#f6f6f4] px-3 font-mono text-xs leading-tight text-[#1b1a17]">
                          <span className="font-semibold">{money(lineVal)} lei</span>
                          <span className="text-[#6f6b63]">TVA {money(lineTva)}, net {money(lineNet)}</span>
                        </div>
                      </Field>
                      <LineControls
                        index={index}
                        total={lines.length}
                        onMove={(direction) => moveLine(line.id, direction)}
                        onRemove={() => removeLine(line.id)}
                      />
                    </div>
                    );
                  })}
                </div>
              </section>

              <div className="ml-auto w-full max-w-xs rounded-xl border border-[#e8e7e3] bg-white p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-[#6f6b63]">TVA plătit (÷6)</span>
                  <span className="font-mono font-semibold">{money(tvaTotal)} lei</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#6f6b63]">Fără TVA</span>
                  <span className="font-mono font-semibold">{money(faraTva)} lei</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-[#efeeeb] pt-2 text-base">
                  <span className="font-semibold text-[#1b1a17]">Total (cu TVA)</span>
                  <span className="font-mono font-bold text-[#1b1a17]">{money(valoare)} lei</span>
                </div>
              </div>

              <Field label="Notițe">
                <textarea className={`${inputClassName} min-h-24 resize-y py-3`} name="notes" placeholder="client, comandă, explicații" />
              </Field>
              <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5">
                <button className={secondaryButtonClassName} type="button" onClick={() => setOpen(false)}>Anulează</button>
                <SubmitButton label="Salvează vânzarea" pending={pending} />
              </div>
            </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}





/** Mută poziția sus/jos (ca în 1C) și o șterge. */
function LineControls({
  index,
  total,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const iconButton =
    "grid size-8 place-items-center rounded-md border border-[#e8e7e3] bg-white text-[#1b1a17] hover:bg-[#f6f6f4] disabled:cursor-not-allowed disabled:opacity-35";
  return (
    <div className="mt-6 flex items-start gap-1">
      <div className="grid gap-1">
        <button
          aria-label={`Mută poziția ${index + 1} mai sus`}
          className={iconButton}
          disabled={index === 0}
          type="button"
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-3.5" aria-hidden="true" />
        </button>
        <button
          aria-label={`Mută poziția ${index + 1} mai jos`}
          className={iconButton}
          disabled={index === total - 1}
          type="button"
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <button
        aria-label={`Șterge poziția ${index + 1}`}
        className={dangerButtonClassName.replace("mt-6 ", "")}
        disabled={total === 1}
        type="button"
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// Aliasuri către shell-ul comun — stilurile drawerelor trăiesc într-un singur loc.
const Field = DrawerField;
const SubmitButton = DrawerSubmit;
const inputClassName = drawerInputClassName;
const primaryButtonClassName =
  "button-primary rounded-md bg-[#1b1a17] px-3 py-2 text-sm font-semibold text-white hover:bg-[#33312c]";
const secondaryButtonClassName = drawerSecondaryButton;
const dangerButtonClassName = drawerDangerButton;
