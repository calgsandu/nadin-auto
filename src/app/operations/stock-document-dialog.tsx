"use client";

import { Plus, Trash2, UserPlus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  createReceiptAction,
  createSaleAction,
  createTransferAction,
  type OperationActionState,
} from "@/app/operations/actions";
import {
  DrawerChoice,
  DrawerField,
  DrawerSubmit,
  OperationDrawer,
  focusFirstLineSearch,
  handleEnterNavigation,
  useDrawerAction,
  useOpenFromUrl,
  drawerFormClassName,
  drawerDangerButton,
  drawerInputClassName,
  drawerSecondaryButton,
} from "@/app/components/operation-drawer";
import { useDrawerDraft } from "@/app/components/use-drawer-draft";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import type { ProductSearchResult } from "@/lib/catalog/product-search";
import { SupplierPicker } from "@/app/partners/supplier-picker";
import { PartnerFormDialog } from "@/app/partners/partner-form-dialog";
import { useOptimisticOptions } from "@/app/components/use-optimistic-options";
import { formatDateInputValue } from "@/lib/operations/date-input";
import { PRICE_CATEGORIES, applyDiscount } from "@/lib/operations/sale-pricing";
import { DEFAULT_QUANTITY, quantityAfterSelect } from "@/lib/operations/default-quantity";

export type WarehouseOption = {
  id: string;
  name: string;
};

export type SupplierOption = {
  id: string;
  name: string;
  /** Doar clienți: datoria curentă („Долг"), pozitivă = ne datorează. */
  balanceLei?: number;
  /** Doar clienți: discountul lui implicit, în procente. */
  discountPercent?: number | null;
};

type StockDocumentDialogProps = {
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
  /** true = se deschide singur când adresa are `?nou=1` (vezi `useOpenFromUrl`). */
  openFromUrl?: boolean;
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
  qty: "",
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

export function StockDocumentDialog({ warehouses, suppliers, openFromUrl }: StockDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  useOpenFromUrl(openFromUrl, () => {
    setMounted(true);
    setOpen(true);
  });
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

  function setLineField(id: number, field: "qty" | "price", value: string) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }

  /** Prețul recepționat pornește de la costul curent și, dacă diferă, îl înlocuiește. */
  function selectReceiptProduct(id: number, productId: string, cost: string, label: string) {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? {
              ...line,
              productId,
              label,
              qty: quantityAfterSelect(productId),
              price: cost,
              oldCost: cost,
            }
          : line,
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

              <section data-drawer-lines className="overflow-visible rounded-xl border border-[#e4e4e7] bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#e4e4e7] bg-[#f4f4f5] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#18181b]">Produse recepționate</h3>
                    <p className="text-xs text-[#52525b]">
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

                <div className="grid gap-1.5 p-2">
                  {lines.map((line, index) => {
                    const lineVal = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    return (
                    <div
                      key={line.id}
                      className="motion-line-item grid gap-2 rounded-md border border-[#f0f0f2] bg-[#ffffff] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_5rem_7.5rem_12.5rem_7.5rem] md:items-start"
                    >
                      <div>
                        <p className="line-label mb-1 text-xs font-semibold leading-5 text-[#52525b]">
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
                        {/* Sub produs, pe un rând (vezi vânzarea): în coloana costului se rupea. */}
                        {line.oldCost && line.price && line.price !== line.oldCost ? (
                          <span className="mt-0.5 block font-mono text-[11px] font-semibold text-[#b45309]">
                            cost curent {money(Number(line.oldCost))} → se actualizează
                          </span>
                        ) : line.oldCost ? (
                          <span className="mt-0.5 block font-mono text-[11px] text-[#52525b]">
                            cost curent {money(Number(line.oldCost))}
                          </span>
                        ) : null}
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
                      </Field>
                      <Field label="Valoare">
                        <div className="flex h-9 items-center whitespace-nowrap rounded-md border border-[#f0f0f2] bg-[#f4f4f5] px-2 text-sm font-semibold tabular-nums text-[#18181b]">
                          {money(lineVal)} lei
                        </div>
                      </Field>
                      <LineControls
                        index={index}
                        total={lines.length}
                        onRemove={() => removeLine(line.id)}
                      />
                    </div>
                    );
                  })}
                </div>
              </section>

              <div className="ml-auto w-full max-w-xs rounded-xl border border-[#e4e4e7] bg-white p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-[#52525b]">TVA</span>
                  <span className="font-mono font-semibold">{money(tvaTotal)} lei</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#52525b]">Fără TVA</span>
                  <span className="font-mono font-semibold">{money(faraTva)} lei</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-[#f0f0f2] pt-2 text-base">
                  <span className="font-semibold text-[#18181b]">Total (cu TVA)</span>
                  <span className="font-mono font-bold text-[#18181b]">{money(valoare)} lei</span>
                </div>
              </div>

              <Field label="Notițe">
                <textarea
                  className={`${inputClassName} min-h-16 resize-y py-2`}
                  name="notes"
                  placeholder="factură, transport, explicații"
                />
              </Field>


              <div className="flex items-center justify-end gap-3 border-t border-[#e4e4e7] pt-5">
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
  const [lines, setLines] = useState<
    { id: number; productId: string; label: string; qty: string }[]
  >([{ id: 1, productId: "", label: "", qty: "" }]);
  function resetLines() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines([{ id, productId: "", label: "", qty: "" }]);
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
    setLines((current) => [{ id, productId: "", label: "", qty: "" }, ...current]);
    focusFirstLineSearch();
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function setTransferProduct(id: number, productId: string, label: string) {
    setLines((current) =>
      current.map((line) =>
        line.id === id
          ? { ...line, productId, label, qty: quantityAfterSelect(productId) }
          : line,
      ),
    );
  }

  function setTransferQty(id: number, qty: string) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, qty } : line)));
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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

              <section data-drawer-lines className="overflow-visible rounded-xl border border-[#e4e4e7] bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#e4e4e7] bg-[#f4f4f5] px-4 py-3">
                  <div>
                    <h3 className="font-semibold text-[#18181b]">Produse transferate</h3>
                    <p className="text-xs text-[#52525b]">
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

                <div className="grid gap-1.5 p-2">
                  {lines.map((line, index) => (
                    <div
                      key={line.id}
                      className="motion-line-item grid gap-2 rounded-md border border-[#f0f0f2] bg-[#ffffff] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_10rem_2.25rem] md:items-start"
                    >
                      <div>
                        <p className="line-label mb-1 text-xs font-semibold leading-5 text-[#52525b]">
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
                          inputMode="numeric"
                          min={1}
                          name="quantity"
                          required
                          type="number"
                          value={line.qty}
                          onChange={(event) => setTransferQty(line.id, event.currentTarget.value)}
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
                  className={`${inputClassName} min-h-16 resize-y py-2`}
                  name="notes"
                  placeholder="motiv, solicitare, responsabil"
                />
              </Field>


              <div className="flex items-center justify-end gap-3 border-t border-[#e4e4e7] pt-5">
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
    // Linia externă n-are căutare de produs care să pună cantitatea, deci
    // pleacă direct cu 1; cea de catalog o primește la alegerea produsului.
    qty: external ? DEFAULT_QUANTITY : "",
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
  openFromUrl,
}: {
  warehouses: WarehouseOption[];
  customers?: SupplierOption[];
  suppliers?: SupplierOption[];
  /** true = se deschide singur când adresa are `?nou=1` (vezi `useOpenFromUrl`). */
  openFromUrl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  // „Client nou" deschide direct fișa de partener: varianta veche scria doar
  // numele, iar clientul rămânea fără IDNO/adresă și bloca mai târziu contul de
  // plată cu „(date incomplete)".
  const [customerForm, setCustomerForm] = useState(false);
  // Clientul creat din fișa completă intră în listă fără să aștepte pagina.
  const { options: customerOptions, add: addCustomer } = useOptimisticOptions(customers);
  const [discount, setDiscount] = useState("0");
  // „Alt discount" ales din listă: câmpul de procente apare chiar dacă valoarea
  // e încă una din categorii.
  const [customDiscount, setCustomDiscount] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<SaleLineState[]>([emptySaleLine(1)]);
  function resetForm() {
    setDiscount("0");
    setCustomDiscount(false);
    setCustomerId("");
    nextLineId.current = 2;
    setLines([emptySaleLine(1)]);
  }
  // Discountul, clientul și linia externă sunt state React (nu câmpuri
  // necontrolate): intră în ciornă cu tot cu linii, altfel s-ar pierde.
  const draft = useDrawerDraft({
    kind: "sale",
    lines: { lines, discount, customerId },
    setLines: (restored) => {
      nextLineId.current = nextIdAfter(restored.lines);
      setLines(restored.lines);
      setDiscount(restored.discount);
      setCustomerId(restored.customerId);
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

  function productFields(product: { id: string; label: string; salePriceLei: string; defaultCostLei: string }) {
    return {
      productId: product.id,
      label: product.label,
      qty: quantityAfterSelect(product.id),
      listPrice: product.salePriceLei,
      unitCost: product.defaultCostLei,
      price: applyDiscount(product.salePriceLei, discount) || product.salePriceLei,
    };
  }

  function selectProduct(
    id: number,
    product: { id: string; label: string; salePriceLei: string; defaultCostLei: string },
  ) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...productFields(product) } : line)),
    );
  }

  async function addProductFromId(productId: string) {
    const response = await fetch(`/api/products/search?id=${encodeURIComponent(productId)}`);
    if (!response.ok) return;
    const data = (await response.json()) as { products: ProductSearchResult[] };
    const product = data.products[0];
    if (!product) return;
    // Rând nou, deja completat: căutarea de produs își ia fișa la montare.
    // Rândurile goale (cel cu care se deschide dialogul) dispar.
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines((current) => [
      { ...emptySaleLine(id), ...productFields(product) },
      ...current.filter((line) => line.external || line.productId),
    ]);
  }
  useOpenFromUrl(openFromUrl, (params) => {
    setMounted(true);
    setOpen(true);
    // „Vinde" din fișa rapidă: produsul intră direct pe primul rând.
    const productId = params.get("produs");
    if (productId) void addProductFromId(productId);
  });

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

  /** Clientul ales își aduce discountul din fișă; operatorul îl poate schimba. */
  function selectCustomer(id: string, discountPercent?: number | null) {
    setCustomerId(id);
    const preset =
      discountPercent === undefined
        ? customerOptions.find((customer) => customer.id === id)?.discountPercent
        : discountPercent;
    changeDiscount(preset ? String(preset) : "0");
  }

  function clearProduct(id: number) {
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, productId: "", label: "", qty: "" } : line,
      ),
    );
  }

  // Prices are VAT-inclusive (gross). TVA = valoare ÷ 6; fără TVA = valoare − TVA.
  const valoare = lines.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0,
  );
  const tvaTotal = Math.round((valoare / 6) * 100) / 100;
  const money = (v: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(v);
  const selectedCustomerDebt =
    customerOptions.find((customer) => customer.id === customerId)?.balanceLei ?? 0;
  const showCustomDiscount = customDiscount || !PRICE_CATEGORIES.some((category) => category.value === discount);

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
              {/* Ordinea muncii la tejghea: cine cumpără, piesele, apoi cum plătește
                  lângă total. Factura și notițele, rar folosite, stau strânse. */}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
                <Field label="Client">
                  <div className="flex gap-2">
                    <select
                      className={inputClassName}
                      name="partnerId"
                      value={customerId}
                      onChange={(event) => selectCustomer(event.currentTarget.value)}
                    >
                      <option value="">Consumator final</option>
                      {customerOptions.map((customer) => (
                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                      ))}
                    </select>
                    <button
                      aria-label="Client nou"
                      className={`${secondaryButtonClassName} shrink-0`}
                      title="Client nou"
                      type="button"
                      onClick={() => setCustomerForm(true)}
                    >
                      <UserPlus className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <PartnerFormDialog
                    defaultKind="CUSTOMER"
                    open={customerForm}
                    onOpenChange={setCustomerForm}
                    onCreated={(partner) => {
                      addCustomer(partner);
                      selectCustomer(partner.id, partner.discountPercent);
                    }}
                  />
                  {selectedCustomerDebt > 0 ? (
                    <span className="text-xs font-medium text-[#b91c1c]">
                      Datorie: {money(selectedCustomerDebt)} lei
                    </span>
                  ) : null}
                </Field>
                <Field label="Din locația">
                  <select className={inputClassName} defaultValue={defaultWarehouse} name="warehouseId" required>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Data">
                  <input className={inputClassName} defaultValue={today} name="documentDate" type="date" />
                </Field>
                <Field label="Discount">
                  <div className="flex gap-2">
                    <select
                      className={inputClassName}
                      value={showCustomDiscount ? "custom" : discount}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setCustomDiscount(value === "custom");
                        if (value !== "custom") changeDiscount(value);
                      }}
                    >
                      {PRICE_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>{category.label}</option>
                      ))}
                      <option value="custom">Alt discount…</option>
                    </select>
                    {showCustomDiscount ? (
                      <input
                        aria-label="Discount (%)"
                        className={`${inputClassName} w-20 shrink-0`}
                        inputMode="decimal"
                        max={100}
                        min={0}
                        name="discountPercent"
                        step="0.01"
                        type="number"
                        value={discount}
                        onChange={(event) => changeDiscount(event.currentTarget.value)}
                      />
                    ) : (
                      <input name="discountPercent" type="hidden" value={discount} />
                    )}
                  </div>
                </Field>
              </div>

              <section data-drawer-lines className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-[#18181b]">Produse</h3>
                  <div className="flex gap-2">
                    <button className={secondaryButtonClassName} type="button" onClick={() => addLine(false)}>
                      <Plus className="size-4" aria-hidden="true" /> Produs
                    </button>
                    <button className={secondaryButtonClassName} type="button" onClick={() => addLine(true)}>
                      <Plus className="size-4" aria-hidden="true" /> Piesă externă
                    </button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  {lines.map((line, index) => {
                    const lineVal = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    if (line.external) {
                      const marja = ((Number(line.price) || 0) - (Number(line.cost) || 0)) * (Number(line.qty) || 0);
                      return (
                        <div key={line.id} className="motion-line-item line-keep-labels grid gap-2 rounded-lg border border-[#dbeafe] bg-[#ffffff] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_7rem_10rem_5rem_6.5rem_7.5rem_2.25rem] md:items-start">
                          <Field label="Piesă externă">
                            <input name="productId" type="hidden" value="" />
                            <input
                              className={inputClassName}
                              name="externalName"
                              placeholder="Denumire piesă"
                              required
                              value={line.name}
                              onChange={(e) => setLineField(line.id, "name", e.currentTarget.value)}
                            />
                          </Field>
                          <Field label="Cod">
                            <input
                              className={inputClassName}
                              name="externalCode"
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
                          <Field label="Cant.">
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
                          <Field label="Cost">
                            <input
                              className={inputClassName}
                              inputMode="decimal"
                              min={0}
                              name="externalCostLei"
                              step="0.01"
                              type="number"
                              value={line.cost}
                              onChange={(e) => setLineField(line.id, "cost", e.currentTarget.value)}
                            />
                          </Field>
                          <Field label="Preț">
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
                              <span className="text-xs text-[#52525b]">marjă {money(marja)} lei</span>
                            ) : null}
                          </Field>
                          <LineControls index={index} total={lines.length} onRemove={() => removeLine(line.id)} />
                        </div>
                      );
                    }
                    const margin =
                      line.unitCost && Number(line.price) > 0
                        ? Math.round(((Number(line.price) - Number(line.unitCost)) / Number(line.price)) * 100)
                        : null;
                    return (
                    <div key={line.id} className="motion-line-item grid gap-2 rounded-lg border border-[#e4e4e7] bg-[#ffffff] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_5rem_7.5rem_8rem_2.25rem] md:items-start">
                      <div>
                        <p className="line-label mb-1 text-sm font-medium text-[#3f3f46]">Produs</p>
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
                        {margin !== null ? (
                          <span className="mt-0.5 block text-xs text-[#71717a]">marjă {margin}%</span>
                        ) : null}
                      </div>
                      <Field label="Cant.">
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
                      <Field label="Preț">
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
                      </Field>
                      <Field label="Sumă">
                        <div className="flex h-9 items-center justify-end whitespace-nowrap px-1 text-sm font-semibold tabular-nums text-[#18181b]">
                          {money(lineVal)} lei
                        </div>
                      </Field>
                      <LineControls index={index} total={lines.length} onRemove={() => removeLine(line.id)} />
                    </div>
                    );
                  })}
                </div>
              </section>

              <div className="grid gap-4 border-t border-[#e4e4e7] pt-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
                <div className="grid gap-3 md:grid-cols-2">
                  <DrawerChoice
                    hint="Alege metoda de plată"
                    label="Plată"
                    name="paymentMethod"
                    options={[
                      { value: "cash", label: "Cash" },
                      { value: "card", label: "Card" },
                      { value: "credit", label: "Pe datorie" },
                      { value: "transfer", label: "Transfer" },
                    ]}
                    required
                  />
                  <DrawerChoice
                    hint="Alege Da sau Nu"
                    label="Bătut la casă?"
                    name="cashRegistered"
                    options={[
                      { value: "yes", label: "Da" },
                      { value: "no", label: "Nu" },
                    ]}
                    required
                  />
                  <details className="group md:col-span-2">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-[#52525b] hover:text-[#18181b] [&::-webkit-details-marker]:hidden">
                      <Plus className="size-4 group-open:rotate-45" aria-hidden="true" /> Factură / notițe
                    </summary>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <Field label="Serie / nr. factură">
                        <input className={inputClassName} name="externalNumber" placeholder="ex. AA 0123456" />
                      </Field>
                      <Field label="Notițe">
                        <textarea className={`${inputClassName} min-h-9 resize-y py-2`} name="notes" rows={1} />
                      </Field>
                    </div>
                  </details>
                </div>
                <div className="rounded-xl bg-[#f4f4f5] px-4 py-3 text-right">
                  <p className="text-sm text-[#52525b]">Total</p>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums text-[#18181b]">{money(valoare)} lei</p>
                  <p className="text-xs text-[#71717a]">din care TVA {money(tvaTotal)} lei</p>
                </div>
              </div>
            </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}





/** Șterge poziția (ultima rămasă nu se poate șterge). */
function LineControls({
  index,
  total,
  onRemove,
}: {
  index: number;
  total: number;
  onRemove: () => void;
}) {
  return (
    <div className="line-offset mt-6 flex items-start">
      <button
        aria-label={`Șterge poziția ${index + 1}`}
        className={dangerButtonClassName.replace("line-offset mt-6 ", "")}
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
  "button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-[#18181b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#27272a]";
const secondaryButtonClassName = drawerSecondaryButton;
const dangerButtonClassName = drawerDangerButton;
