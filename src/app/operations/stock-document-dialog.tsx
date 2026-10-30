"use client";

import { ArrowRightLeft, Banknote, Clock, CreditCard, FileText, Landmark, Package, PackagePlus, Plus, ShoppingCart, Trash2, UserPlus, Wallet } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  createReceiptAction,
  createSaleAction,
  createTransferAction,
  type OperationActionState,
} from "@/app/operations/actions";
import {
  DrawerCard,
  DrawerChoice,
  DrawerField,
  DrawerTotal,
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
import { StickerPrintButton, type StickerLine } from "@/app/operations/drawer-line-tools";
import type { ProductSearchResult } from "@/lib/catalog/product-search";
import { SupplierPicker } from "@/app/partners/supplier-picker";
import { PartnerFormDialog } from "@/app/partners/partner-form-dialog";
import { useOptimisticOptions } from "@/app/components/use-optimistic-options";
import { formatDateInputValue } from "@/lib/operations/date-input";
import { PRICE_CATEGORIES, applyDiscount } from "@/lib/operations/sale-pricing";
import { DEFAULT_QUANTITY, quantityAfterSelect } from "@/lib/operations/default-quantity";
import type { RestockTransferPrefill } from "@/lib/operations/restock";

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

/**
 * Ultima locație aleasă, ținută în browser: următorul document pleacă din
 * același loc, fără s-o alegi din nou. O locație dispărută cade pe implicită.
 */
function rememberedWarehouse(kind: string, warehouses: WarehouseOption[], fallback: string) {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(`nadin:locatie:${kind}`);
    if (saved && warehouses.some((warehouse) => warehouse.id === saved)) return saved;
  } catch {
    // Stocare blocată (fereastră privată): rămâne locația implicită.
  }
  return fallback;
}

function rememberWarehouse(kind: string, warehouseId: string) {
  try {
    window.localStorage.setItem(`nadin:locatie:${kind}`, warehouseId);
  } catch {
    // Vezi mai sus.
  }
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
  // Rândurile trimise: după salvare, din ele ies stickerele pentru piesele primite.
  const submittedLines = useRef<ReceiptLine[]>([]);
  const [printable, setPrintable] = useState<StickerLine[]>([]);
  const { pending, onSubmit } = useDrawerAction(
    createReceiptAction,
    initialState,
    () => {
      setPrintable(
        submittedLines.current
          .filter((line) => line.productId && Number(line.qty) > 0)
          .map((line) => ({ productId: line.productId, sticker: true, copies: line.qty })),
      );
      resetLines();
      draft.clear();
      // Panoul rămâne deschis: cursorul trece direct la următoarea recepție.
      focusFirstLineSearch();
    },
  );
  const [defaultWarehouse] = useState(() => rememberedWarehouse("receipt", warehouses, warehouses[0]?.id ?? ""));
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
          icon={PackagePlus}
          open={open}
          pending={pending}
          submitLabel="Salvează recepția"
          draft={draft.banner}
          onClose={() => {
            setOpen(false);
            setPrintable([]);
          }}
        >
          <form
            ref={attachForm}
            onSubmit={(event) => {
              submittedLines.current = lines;
              onSubmit(event);
            }}
            className={drawerFormClassName}
            onKeyDown={(event) => handleEnterNavigation(event, addLine)}
          >
              <input name="idempotencyKey" type="hidden" value={draft.token} />
              {printable.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f0fdf4] px-3 py-2 text-sm text-[#166534]">
                  <span>Recepția e salvată. Stickere pentru piesele primite:</span>
                  <div className="flex items-center gap-2">
                    <StickerPrintButton lines={printable} />
                    <button
                      aria-label="Ascunde"
                      className="grid size-8 place-items-center rounded-md text-[#166534] hover:bg-[#dcfce7]"
                      type="button"
                      onClick={() => setPrintable([])}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : null}
              {/* Ca la vânzare: de la cine și unde intră marfa, piesele, apoi totalul.
                  Notițele, rar folosite, stau strânse. */}
              <DrawerCard icon={FileText} title="Detalii">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
                <Field label="Furnizor">
                  <SupplierPicker
                    className={inputClassName}
                    name="partnerId"
                    suppliers={suppliers}
                  />
                </Field>
                <Field label="În locația">
                  <select
                    className={inputClassName}
                    defaultValue={defaultWarehouse}
                    name="warehouseId"
                    required
                    onChange={(event) => rememberWarehouse("receipt", event.currentTarget.value)}
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Data">
                  <input
                    className={inputClassName}
                    defaultValue={today}
                    name="documentDate"
                    type="date"
                  />
                </Field>
                <Field label="Nr. factură">
                  <input className={inputClassName} name="externalNumber" placeholder="ex. AA 0123456" />
                </Field>
              </div>
              </DrawerCard>

              <DrawerCard
                lines
                icon={PackagePlus}
                title="Produse"
                action={
                  <button className={secondaryButtonClassName} type="button" onClick={addLine}>
                    <Plus className="size-4" aria-hidden="true" /> Produs
                  </button>
                }
              >
                <div className="grid gap-1.5">
                  {lines.map((line, index) => {
                    const lineVal = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    // Costul nou înlocuiește costul din fișă; arătăm doar când chiar diferă.
                    const costChanged = Boolean(line.oldCost && line.price && line.price !== line.oldCost);
                    return (
                    <div
                      key={line.id}
                      className="motion-line-item grid gap-2 rounded-lg border border-[#ececef] bg-[#fafafa] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_5rem_7.5rem_8rem_2.25rem] md:items-start"
                    >
                      <div>
                        <p className="line-label mb-1 text-sm font-medium text-[#3f3f46]">Produs</p>
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
                          name="unitCostLei"
                          placeholder="auto"
                          step="0.01"
                          type="number"
                          value={line.price}
                          onChange={(e) => setLineField(line.id, "price", e.currentTarget.value)}
                        />
                        {costChanged ? (
                          <span className="text-xs font-medium text-[#b45309]">era {money(Number(line.oldCost))} lei</span>
                        ) : null}
                      </Field>
                      <Field label="Sumă">
                        <div className="flex h-9 items-center justify-end whitespace-nowrap px-1 text-sm font-semibold tabular-nums text-[#18181b]">
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
              </DrawerCard>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
                <details className="group">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-[#52525b] hover:text-[#18181b] [&::-webkit-details-marker]:hidden">
                    <Plus className="size-4 group-open:rotate-45" aria-hidden="true" /> Notițe
                  </summary>
                  <textarea
                    aria-label="Notițe"
                    className={`${inputClassName} mt-2 min-h-16 resize-y py-2`}
                    name="notes"
                    placeholder="transport, explicații"
                  />
                </details>
                <DrawerTotal total={money(valoare)} vat={money(tvaTotal)} />
              </div>
            </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}

type TransferLine = { id: number; productId: string; label: string; qty: string };

export function StockTransferDialog({
  warehouses,
  prefill,
}: {
  warehouses: WarehouseOption[];
  /** Dat = butonul din „De adus": deschide transferul cu piesele deja puse. */
  prefill?: RestockTransferPrefill;
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<TransferLine[]>([{ id: 1, productId: "", label: "", qty: "" }]);
  // Câte piese de adus nu sunt deloc în depozitul sursă ales.
  const [missingFromSource, setMissingFromSource] = useState(0);
  // Cu precompletare, sursa e controlată: schimbarea ei recalculează rândurile.
  const [sourceId, setSourceId] = useState(prefill?.sourceWarehouseId ?? "");

  /** Rândurile din lista „De adus", cât are depozitul sursă (cel mult cât trebuie). */
  function fillFromRestock(sourceWarehouseId: string) {
    if (!prefill) return;
    const filled: TransferLine[] = [];
    let missing = 0;
    for (const item of prefill.items) {
      const available =
        prefill.stocks.find((stock) => stock.productId === item.productId && stock.warehouseId === sourceWarehouseId)
          ?.quantity ?? 0;
      const quantity = Math.min(item.quantity, available);
      if (quantity <= 0) {
        missing += 1;
        continue;
      }
      filled.push({ id: nextLineId.current++, productId: item.productId, label: item.label, qty: String(quantity) });
    }
    setMissingFromSource(missing);
    setLines(filled.length > 0 ? filled : [{ id: nextLineId.current++, productId: "", label: "", qty: "" }]);
  }
  function resetLines() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines([{ id, productId: "", label: "", qty: "" }]);
  }
  const draft = useDrawerDraft({
    kind: prefill ? "restock-transfer" : "transfer",
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
  const defaultSourceWarehouse = prefill?.sourceWarehouseId ?? warehouses[0]?.id ?? "";
  const defaultDestinationWarehouse =
    prefill?.destinationWarehouseId ??
    warehouses.find((warehouse) => warehouse.id !== defaultSourceWarehouse)?.id ??
    "";
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
    if (prefill) {
      // Lista „De adus" poate s-o fi schimbat de la ultima deschidere: o luăm de la capăt.
      setSourceId(prefill.sourceWarehouseId);
      fillFromRestock(prefill.sourceWarehouseId);
    }
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
        {prefill ? "Adu în 110A" : "Adaugă transfer"}
      </button>

      {mounted ? (
        <OperationDrawer
          title="Transfer între locații"
          icon={ArrowRightLeft}
          open={open}
          pending={pending}
          submitLabel="Salvează transferul"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
              <input name="idempotencyKey" type="hidden" value={draft.token} />
              <DrawerCard icon={ArrowRightLeft} title="De unde și unde">
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
                    defaultValue={prefill ? undefined : defaultSourceWarehouse}
                    name="sourceWarehouseId"
                    required
                    value={prefill ? sourceId : undefined}
                    onChange={(event) => {
                      if (!prefill) return;
                      setSourceId(event.currentTarget.value);
                      fillFromRestock(event.currentTarget.value);
                    }}
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

              {prefill && missingFromSource > 0 ? (
                <p className="rounded-md bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e]">
                  {missingFromSource === 1 ? "O piesă de adus nu e" : `${missingFromSource} piese de adus nu sunt`} în depozitul
                  ales. Alege alt depozit sus pentru ele.
                </p>
              ) : null}

              </DrawerCard>

              <DrawerCard
                lines
                icon={Package}
                title="Produse"
                action={
                  <button className={secondaryButtonClassName} type="button" onClick={addLine}>
                    <Plus className="size-4" aria-hidden="true" /> Produs
                  </button>
                }
              >
                <div className="grid gap-1.5">
                  {lines.map((line, index) => (
                    <div
                      key={line.id}
                      className="motion-line-item grid gap-2 rounded-lg border border-[#ececef] bg-[#fafafa] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_7rem_2.25rem] md:items-start"
                    >
                      <div>
                        <p className="line-label mb-1 text-sm font-medium text-[#3f3f46]">Produs</p>
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
                      <Field label="Cant.">
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
              </DrawerCard>

              <Field label="Notițe">
                <textarea
                  className={`${inputClassName} min-h-16 resize-y py-2`}
                  name="notes"
                  placeholder="motiv, solicitare, responsabil"
                />
              </Field>

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
  /** Stocul produsului pe depozite (din căutare) — pentru avertismentul de stoc. */
  stocks: { warehouseId: string; quantity: number }[];
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
    stocks: [],
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
  const [warehouseId, setWarehouseId] = useState(() =>
    rememberedWarehouse(
      "sale",
      warehouses,
      warehouses.find((warehouse) => warehouse.name === "Pavilion 110A")?.id ?? warehouses[0]?.id ?? "",
    ),
  );
  // Doar pentru avertismentul „pe datorie fără client"; valoarea pleacă din radio.
  const [paymentMethod, setPaymentMethod] = useState("");
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<SaleLineState[]>([emptySaleLine(1)]);
  function resetForm() {
    setDiscount("0");
    setCustomDiscount(false);
    setCustomerId("");
    setPaymentMethod("");
    nextLineId.current = 2;
    setLines([emptySaleLine(1)]);
  }
  // Discountul, clientul și linia externă sunt state React (nu câmpuri
  // necontrolate): intră în ciornă cu tot cu linii, altfel s-ar pierde.
  const draft = useDrawerDraft({
    kind: "sale",
    lines: { lines, discount, customerId, warehouseId },
    setLines: (restored) => {
      nextLineId.current = nextIdAfter(restored.lines);
      // Ciornele vechi n-aveau stocurile pe rând: lipsa lor doar ascunde avertismentul.
      setLines(restored.lines.map((line) => ({ ...line, stocks: line.stocks ?? [] })));
      setDiscount(restored.discount);
      setCustomerId(restored.customerId);
      if (restored.warehouseId) setWarehouseId(restored.warehouseId);
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
  const today = useMemo(() => formatDateInputValue(new Date()), []);
  const warehouseName = warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? "locația aleasă";

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

  function productFields(product: {
    id: string;
    label: string;
    salePriceLei: string;
    defaultCostLei: string;
    stocks?: { warehouseId: string; quantity: number }[];
  }) {
    return {
      productId: product.id,
      label: product.label,
      qty: quantityAfterSelect(product.id),
      listPrice: product.salePriceLei,
      unitCost: product.defaultCostLei,
      price: applyDiscount(product.salePriceLei, discount) || product.salePriceLei,
      stocks: product.stocks ?? [],
    };
  }

  function selectProduct(
    id: number,
    product: Parameters<typeof productFields>[0],
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
        line.id === id ? { ...line, productId: "", label: "", qty: "", stocks: [] } : line,
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
          icon={ShoppingCart}
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
              <DrawerCard icon={FileText} title="Detalii">
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
                  <select
                    className={inputClassName}
                    name="warehouseId"
                    required
                    value={warehouseId}
                    onChange={(event) => {
                      setWarehouseId(event.currentTarget.value);
                      rememberWarehouse("sale", event.currentTarget.value);
                    }}
                  >
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
              </DrawerCard>

              <DrawerCard
                lines
                icon={Package}
                title="Produse"
                action={
                  <div className="flex gap-2">
                    <button className={secondaryButtonClassName} type="button" onClick={() => addLine(false)}>
                      <Plus className="size-4" aria-hidden="true" /> Produs
                    </button>
                    <button className={secondaryButtonClassName} type="button" onClick={() => addLine(true)}>
                      <Plus className="size-4" aria-hidden="true" /> Piesă externă
                    </button>
                  </div>
                }
              >
                <div className="grid gap-1.5">
                  {lines.map((line, index) => {
                    const lineVal = (Number(line.qty) || 0) * (Number(line.price) || 0);
                    if (line.external) {
                      const marja = ((Number(line.price) || 0) - (Number(line.cost) || 0)) * (Number(line.qty) || 0);
                      return (
                        <div key={line.id} className="motion-line-item line-keep-labels grid gap-2 rounded-lg border border-[#dbeafe] bg-[#f5f9ff] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_7rem_13rem_5rem_6.5rem_7.5rem_2.25rem] md:items-start">
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
                    const belowCost = margin !== null && margin < 0;
                    // Stocul din locația aleasă, ca să nu vinzi ce nu e pe raft.
                    const stockHere = line.stocks.find((stock) => stock.warehouseId === warehouseId)?.quantity ?? 0;
                    const stockElsewhere = line.stocks.reduce((sum, stock) => sum + stock.quantity, 0) - stockHere;
                    const showStock = Boolean(line.productId) && line.stocks.length > 0;
                    const notEnough = showStock && (Number(line.qty) || 0) > stockHere;
                    return (
                    <div key={line.id} className="motion-line-item grid gap-2 rounded-lg border border-[#ececef] bg-[#fafafa] px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_5rem_7.5rem_8rem_2.25rem] md:items-start">
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
                        {showStock || margin !== null ? (
                          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[#71717a]">
                            {showStock ? (
                              notEnough ? (
                                <span className="font-medium text-[#b91c1c]">
                                  {stockHere > 0 ? `doar ${stockHere} în ${warehouseName}` : `nu e în ${warehouseName}`}
                                  {stockElsewhere > 0 ? ` · ${stockElsewhere} în alte depozite` : ""}
                                </span>
                              ) : (
                                <span>{stockHere} în stoc aici</span>
                              )
                            ) : null}
                            {margin !== null ? (
                              <span className={belowCost ? "font-medium text-[#b91c1c]" : undefined}>
                                {belowCost ? `sub cost (${money(Number(line.unitCost))} lei)` : `marjă ${margin}%`}
                              </span>
                            ) : null}
                          </span>
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
                          className={`${inputClassName} ${belowCost ? "border-[#f87171]! bg-[#fef2f2]!" : ""}`}
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
              </DrawerCard>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
                <DrawerCard icon={Wallet} title="Plată">
                <div
                  className="grid gap-3 md:grid-cols-2"
                  onChange={(event) => {
                    const target = event.target as HTMLInputElement;
                    if (target.name === "paymentMethod") setPaymentMethod(target.value);
                  }}
                >
                  <DrawerChoice
                    hint="Alege metoda de plată"
                    label="Metoda de plată"
                    name="paymentMethod"
                    options={[
                      { value: "cash", label: "Cash", icon: Banknote },
                      { value: "card", label: "Card", icon: CreditCard },
                      { value: "credit", label: "Pe datorie", icon: Clock },
                      { value: "transfer", label: "Transfer", icon: Landmark },
                    ]}
                    required
                  />
                  {paymentMethod === "credit" && !customerId ? (
                    <p className="rounded-md bg-[#fffbeb] px-3 py-2 text-sm text-[#92400e] md:col-span-2">
                      Pe datorie cu „Consumator final”: datoria nu se scrie pe nimeni. Alege clientul sus.
                    </p>
                  ) : null}
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
                </DrawerCard>
                <DrawerTotal total={money(valoare)} vat={money(tvaTotal)} />
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
const inputClassName = drawerInputClassName;
const primaryButtonClassName =
  "button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-[#18181b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#27272a]";
const secondaryButtonClassName = drawerSecondaryButton;
const dangerButtonClassName = drawerDangerButton;
