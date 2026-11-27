"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Banknote, Car, ChevronDown, ClipboardCheck, ListPlus, PackagePlus, PackageSearch, Pencil, Plus, SlidersHorizontal, Tag, Trash2, Warehouse } from "lucide-react";
import {
  createProductAction,
  updateProductAction,
  type CatalogActionState,
} from "@/app/catalog/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { CloseIconButton, IconLabel, rowIconButtonCls, SaveButton } from "@/app/components/icon-buttons";
import {
  drawerBoundaryProps,
  handleEnterNavigation,
  ModalSection as Section,
  ModalSectionTitle as SectionTitle,
  modalBackdropClassName,
  modalHeaderClassName,
  modalPanelClassName,
  modalSectionGridClassName,
  useDrawerAction,
  useModalFocus,
} from "@/app/components/operation-drawer";
import { BrandSelect, ModelSelect } from "@/app/admin/admin-dialogs";
import { ProductCodeField } from "@/app/catalog/product-code-field";
import { AddToStickersButton } from "@/app/catalog/add-to-stickers";
import type { ProductSearchResult } from "@/lib/catalog/product-search";
import type { StockReason } from "@/lib/catalog/product-stock-documents";
import type { StockTargets } from "@/app/api/catalog/stock-targets/route";

/**
 * Doar câmpurile folosite de formular, nu modelele Prisma întregi: aceleași
 * liste vin și de la pagina server (obiecte Prisma), și prin JSON de la
 * `/api/catalog/form-options` (unde datele calendaristice ar fi devenit text).
 */
export type CatalogFormOptions = {
  brands: Array<{ id: string; name: string }>;
  models: Array<{ id: string; name: string; brandId: string }>;
  types: Array<{ id: string; name: string }>;
  warehouses: Array<{ id: string; name: string }>;
};

/**
 * Opțiunile cerute la nevoie, pentru formularul deschis din INTERIORUL altui
 * dialog: paginile de operațiuni nu au brandurile/modelele/tipurile, fiindcă
 * `getOperationsData` a fost subțiat intenționat. O singură cerere pe sesiune
 * de pagină, oricâte rânduri ar avea documentul.
 */
let optionsPromise: Promise<CatalogFormOptions> | null = null;

export function loadCatalogFormOptions() {
  optionsPromise ??= fetch("/api/catalog/form-options")
    .then((response) => {
      if (!response.ok) throw new Error(`form-options: ${response.status}`);
      return response.json() as Promise<CatalogFormOptions>;
    })
    .catch((error: unknown) => {
      // O cădere de rețea n-are voie să ascundă butonul până la refresh.
      optionsPromise = null;
      throw error;
    });

  return optionsPromise;
}

type ProductFormDialogProps = CatalogFormOptions & {
  product?: ProductFormValue;
  /** Ignorat în modul controlat (butonul îl randează cel care deschide dialogul). */
  triggerLabel?: string;
  triggerKind?: "primary" | "row" | "secondary";
  /**
   * Dat = mod controlat: dialogul nu-și mai randează butonul, iar deschiderea
   * o decide părintele (dialogul din care s-a plecat).
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Produsul creat, gata de pus înapoi pe rândul din care s-a plecat. */
  onCreated?: (product: ProductSearchResult) => void;
  /** Preumple descrierea cu ce apucase operatorul să tasteze în căutare. */
  initialDescription?: string;
};

export type ExtraFitmentValue = {
  brandId: string;
  modelId: string;
  yearStart: string;
  yearEnd: string;
  yearOpenEnded: boolean;
};

export type ProductFormValue = {
  id: string;
  externalCode: string;
  alternativeCode: string;
  brandId: string;
  modelId: string;
  typeId: string;
  description: string;
  descriptionRu: string;
  notes: string;
  notesRu: string;
  yearStart: string;
  yearEnd: string;
  yearOpenEnded: boolean;
  /** Compatibilități suplimentare (gemenii: Sprinter ↔ Crafter etc.). */
  extraFitments: ExtraFitmentValue[];
  isLocal: boolean;
  warehouseStocks: Array<{ warehouseId: string; quantity: string }>;
  minStock: string;
  priceEuro: string;
  costLei: string;
  salePriceLei: string;
};

const initialState: CatalogActionState = {
  ok: false,
  message: "",
};

export function ProductFormDialog({
  brands,
  models,
  types,
  warehouses,
  product,
  triggerLabel,
  triggerKind = "primary",
  open: controlledOpen,
  onOpenChange,
  onCreated,
  initialDescription,
}: ProductFormDialogProps) {
  const controlled = controlledOpen !== undefined;
  const [selfOpen, setSelfOpen] = useState(false);
  const open = controlled ? controlledOpen : selfOpen;
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const [warehouseQuantities, setWarehouseQuantities] = useState<Record<string, string>>(
    () => getWarehouseQuantities(product, warehouses),
  );
  /**
   * Compatibilitățile produsului, într-o SINGURĂ listă: prima e cea principală
   * (brandul/modelul/anii produsului), restul sunt gemenii. Înainte erau două
   * locuri diferite în formular pentru același lucru.
   */
  const [fitments, setFitments] = useState<ExtraFitmentValue[]>(
    () => toFitments(product),
  );
  // Costul și prețul, urmărite ca să arătăm pe loc prețul automat și marja.
  const [cost, setCost] = useState(product?.costLei ?? "");
  const [salePrice, setSalePrice] = useState(product?.salePriceLei ?? "");
  // „+ Tip nou…" ales din listă: apare câmpul pentru numele tipului.
  const [newType, setNewType] = useState(false);
  // De unde vine stocul schimbat. Nu se golește la „Încă unul": piesele unui
  // inventar sau ale unei recepții se introduc una după alta.
  const [stockReason, setStockReason] = useState<StockReason | "">("");
  // Documentul ales (gol = cel de azi din fișe) și furnizorul recepției noi;
  // rămân și ele la „Încă unul", ca piesele să intre în același document.
  const [stockDocumentId, setStockDocumentId] = useState("");
  const [stockPartnerId, setStockPartnerId] = useState("");
  const [stockTargets, setStockTargets] = useState<StockTargets | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const action = product ? updateProductAction : createProductAction;
  // Fără resetul automat al React: la eroare rămâne tot completat.
  // „Salvează și adaugă altul": la inventar se introduc piese una după alta,
  // adesea pentru aceeași mașină — tipul și mașinile rămân, restul se golește.
  const continueAfterSave = useRef(false);
  const submittedStock = useRef(0);
  // Tipul ales, citit la trimitere: la succes formularul e deja golit (`useDrawerAction`).
  const submittedType = useRef("");
  const [lastSaved, setLastSaved] = useState<{ id: string; label: string; copies: number } | null>(null);
  const { pending, onSubmit } = useDrawerAction(action, initialState, (saved) => {
    if (continueAfterSave.current) {
      continueAfterSave.current = false;
      if (saved.created) {
        setLastSaved({ id: saved.created.id, label: saved.created.label, copies: submittedStock.current });
      }
      prepareNext();
      return;
    }
    setOpen(false);
    setMounted(false);
    setLastSaved(null);
    // Cel care a deschis dialogul primește produsul gata de selectat pe rândul
    // în lucru — altfel ar trebui să-l caute din nou după ce l-a creat.
    if (saved.created) onCreated?.(saved.created);
  });

  /** Formular gol pentru piesa următoare, cu tipul și mașinile păstrate. */
  function prepareNext() {
    const form = formRef.current;
    const typeSelect = form?.querySelector<HTMLSelectElement>('select[name="typeId"]');
    form?.reset();
    // Un tip nou abia creat nu e încă în listă: atunci rămâne „Alege tipul".
    if (typeSelect && submittedType.current !== NEW_TYPE) typeSelect.value = submittedType.current;
    setWarehouseQuantities(getWarehouseQuantities(undefined, warehouses));
    setCost("");
    setSalePrice("");
    setNewType(false);
    requestAnimationFrame(() => form?.querySelector<HTMLInputElement>('input[name="externalCode"]')?.focus());
  }

  function submit(continueNext: boolean) {
    continueAfterSave.current = continueNext;
    submittedStock.current = calculateTotal(warehouseQuantities);
    submittedType.current =
      formRef.current?.querySelector<HTMLSelectElement>('select[name="typeId"]')?.value ?? "";
    formRef.current?.requestSubmit();
  }
  // Modal PESTE documentul din care s-a plecat (inventar, recepție), care
  // rămâne vizibil în spate.
  useModalFocus(formRef, open);

  function setOpen(next: boolean) {
    if (!controlled) setSelfOpen(next);
    onOpenChange?.(next);
  }

  function initFields() {
    setFitments(toFitments(product));
    setWarehouseQuantities(getWarehouseQuantities(product, warehouses));
    setCost(product?.costLei ?? "");
    setSalePrice(product?.salePriceLei ?? "");
    setNewType(false);
  }

  const originalQuantities = getWarehouseQuantities(product, warehouses);
  const stockDiffs = warehouses.map(
    (warehouse) => (Number(warehouseQuantities[warehouse.id]) || 0) - (Number(originalQuantities[warehouse.id]) || 0),
  );
  const stockChanged = stockDiffs.some((diff) => diff !== 0);
  const stockDecreased = stockDiffs.some((diff) => diff < 0);
  const changedWarehouseIds = warehouses.filter((_, index) => stockDiffs[index] !== 0).map((warehouse) => warehouse.id);
  const wantTargets = stockChanged && stockReason !== "";
  // Cerute din nou la fiecare schimbare de stoc: între timp poate fi apărut
  // documentul de azi, creat de piesa salvată înainte.
  useEffect(() => {
    if (!wantTargets) return;
    let live = true;
    fetch("/api/catalog/stock-targets")
      .then((response) => (response.ok ? (response.json() as Promise<StockTargets>) : null))
      .then((targets) => {
        if (live && targets) setStockTargets(targets);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wantTargets]);
  // Un document existent e pe un singur depozit, deci se poate alege doar
  // când stocul s-a schimbat într-un singur depozit.
  const targetDocuments =
    changedWarehouseIds.length === 1
      ? (stockTargets?.documents ?? []).filter(
          (document) => document.kind === stockReason && document.warehouseId === changedWarehouseIds[0],
        )
      : [];
  const chosenDocument = targetDocuments.find((document) => document.id === stockDocumentId) ?? null;
  const costValue = Number(cost.replace(",", ".")) || 0;
  const saleValue = Number(salePrice.replace(",", ".")) || 0;
  const effectiveSale = saleValue || costValue * 2;
  const margin = costValue > 0 && effectiveSale > 0 ? Math.round(((effectiveSale - costValue) / effectiveSale) * 100) : null;
  const filledDetails = [
    product?.alternativeCode,
    product?.priceEuro,
    product?.minStock,
    product?.isLocal,
    product?.descriptionRu,
    product?.notes,
    product?.notesRu,
  ].filter(Boolean).length;

  // În modul controlat nu trece nimeni prin `openDialog`, dar panoul tot trebuie
  // montat (și inițializat) la prima deschidere. Ajustarea stării în timpul
  // randării, nu într-un efect: altfel prima randare a panoului ar pleca cu
  // valorile vechi și abia a doua le-ar corecta.
  if (open && !mounted) {
    initFields();
    setMounted(true);
  }
  function addFitment() {
    setFitments((current) => [...current, emptyFitment()]);
  }

  function patchFitment(index: number, patch: Partial<ExtraFitmentValue>) {
    setFitments((current) =>
      current.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  function removeFitment(index: number) {
    setFitments((current) => current.filter((_, position) => position !== index));
  }

  function openDialog() {
    // Ciorna se păstrează: câmpurile se re-inițializează doar la prima deschidere
    // (sau după o salvare reușită, care demontează panoul).
    if (!mounted) {
      initFields();
      setMounted(true);
    }
    setOpen(true);
  }

  return (
    <>
      {controlled ? null : (
        <button
          className={
            triggerKind === "row"
              ? rowIconButtonCls
              : triggerKind === "secondary"
                ? "button-secondary inline-flex h-10 items-center gap-2 rounded-md border border-(--c-line) bg-(--c-surface) px-3 text-sm font-medium text-(--c-ink) hover:bg-(--c-hover)"
                : "button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-(--c-accent) px-3.5 py-2 text-sm font-semibold text-white hover:bg-(--c-accent-hover)"
          }
          title={triggerKind === "row" ? triggerLabel : undefined}
          type="button"
          onClick={openDialog}
        >
          {triggerKind === "row" ? (
            <>
              <Pencil aria-hidden="true" />
              <IconLabel>{triggerLabel ?? "Editează"}</IconLabel>
            </>
          ) : triggerKind === "secondary" ? (
            <>
              <Pencil className="size-4" aria-hidden="true" /> {triggerLabel ?? "Editează"}
            </>
          ) : (
            triggerLabel
          )}
        </button>
      )}

      {mounted ? (
        <DrawerPortal locked={open}>
          <div
            className={modalBackdropClassName}
            style={open ? undefined : { display: "none" }}
            {...drawerBoundaryProps}
          >
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            aria-label="Închide formularul"
            onClick={() => setOpen(false)}
          />
          <aside
            className={modalPanelClassName("lg")}
            onKeyDown={(event) => {
              // Ca în celelalte panouri: Ctrl+Enter salvează, Esc închide.
              if ((event.ctrlKey || event.metaKey) && (event.key === "Enter" || event.key.toLowerCase() === "s")) {
                event.preventDefault();
                event.stopPropagation();
                if (!pending) submit(false);
                return;
              }
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setOpen(false);
            }}
            onFocus={(event) => {
              const target = event.target;
              if (target instanceof HTMLInputElement && target.type === "number") {
                requestAnimationFrame(() => target.select());
              }
            }}
            onWheel={(event) => {
              const target = event.target;
              if (target instanceof HTMLInputElement && target.type === "number" && target === document.activeElement) {
                target.blur();
              }
            }}
          >
            <div className={modalHeaderClassName(true)}>
              <h2 className="flex items-center gap-2.5 text-lg font-semibold text-(--c-ink)">
                <span className="grid size-8 place-items-center rounded-lg bg-(--c-accent) text-white">
                  <PackageSearch className="size-4" aria-hidden="true" />
                </span>
                {product ? "Editează produs" : "Adaugă produs"}
              </h2>
              <div className="flex items-center gap-2">
                {/* Doar la produs nou, deschis direct (nu din vânzare/recepție). */}
                {!product && !controlled ? (
                  <button
                    className="button-secondary hidden h-9 items-center justify-center gap-1.5 rounded-md border border-(--c-line) bg-(--c-surface) px-3 text-sm font-semibold text-(--c-ink) hover:bg-(--c-hover) disabled:opacity-60 sm:inline-flex"
                    disabled={pending}
                    title="Salvează și adaugă altul"
                    aria-label="Salvează și adaugă altul"
                    type="button"
                    onClick={() => submit(true)}
                  >
                    <ListPlus className="size-4" aria-hidden="true" />
                    <span aria-hidden="true">Încă unul</span>
                  </button>
                ) : null}
                <SaveButton
                  label={product ? "Salvează" : "Adaugă produsul"}
                  pending={pending}
                  onClick={() => submit(false)}
                />
                <CloseIconButton
                  onClick={() => {
                    setOpen(false);
                    setLastSaved(null);
                  }}
                />
              </div>
            </div>

            <form
              ref={formRef}
              onSubmit={onSubmit}
              onKeyDown={(event) => handleEnterNavigation(event)}
            >
              {product ? (
                <input name="productId" type="hidden" value={product.id} />
              ) : null}

              {lastSaved ? (
                <div className="mx-5 my-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-(--c-green-soft) px-3 py-2 text-sm text-(--c-green)">
                  <span className="min-w-0 truncate">Salvat: {lastSaved.label}</span>
                  <div className="flex items-center gap-2">
                    <AddToStickersButton
                      className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-(--c-green-line) bg-(--c-surface) px-3 py-1.5 text-sm font-semibold text-(--c-ink) hover:bg-(--c-hover)"
                      items={[{ id: lastSaved.id, count: Math.max(lastSaved.copies, 1) }]}
                    />
                    <button
                      aria-label="Ascunde"
                      className="grid size-8 place-items-center rounded-md hover:bg-(--c-green-soft)"
                      type="button"
                      onClick={() => setLastSaved(null)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Ordinea în care se scrie o piesă: codul, ce e, ce tip. */}
              <Section icon={Tag} title="Piesa">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_11rem]">
                <Field label="Cod">
                  <ProductCodeField
                    className={inputClassName}
                    defaultValue={product?.externalCode ?? ""}
                    productId={product?.id}
                  />
                </Field>
                {/* Pe telefon: codul și tipul pe un rând, descrierea dedesubt. */}
                <Field label="Descriere" className="max-sm:order-last max-sm:col-span-2">
                  <textarea
                    className={`${inputClassName} min-h-9 resize-y py-2`}
                    rows={1}
                    name="description"
                    defaultValue={product?.description ?? initialDescription ?? ""}
                    placeholder="ex. Prag 4/5uși L"
                    required
                  />
                </Field>
                <Field label="Tip">
                  <select
                    className={inputClassName}
                    name="typeId"
                    defaultValue={product?.typeId ?? ""}
                    onChange={(event) => setNewType(event.currentTarget.value === NEW_TYPE)}
                  >
                    <option value="">Alege tipul</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                    <option value={NEW_TYPE}>+ Tip nou…</option>
                  </select>
                  {newType ? (
                    <input
                      autoFocus
                      className={inputClassName}
                      name="newTypeName"
                      placeholder="Numele tipului nou"
                      required
                    />
                  ) : null}
                </Field>
              </div>
              </Section>

              <Section
                icon={Car}
                title="Mașini"
                hint={fitments.length === 1 ? "1 mașină" : `${fitments.length} mașini`}
              >
                <div className="grid divide-y divide-(--c-line-2)">
                  {fitments.map((fitment, index) => (
                    <FitmentRow
                      key={index}
                      brands={brands}
                      models={models}
                      primary={index === 0}
                      value={fitment}
                      onChange={(patch) => patchFitment(index, patch)}
                      onRemove={index === 0 ? undefined : () => removeFitment(index)}
                    />
                  ))}
                </div>
                <button
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-(--c-accent) hover:underline"
                  type="button"
                  onClick={addFitment}
                >
                  <Plus className="size-4" aria-hidden="true" /> Altă mașină
                </button>
              </Section>

              <Section
                icon={Banknote}
                title="Preț"
                hint={
                  margin === null ? undefined : margin < 0 ? (
                    <span className="font-medium text-(--c-red)">sub cost</span>
                  ) : (
                    `marjă ${margin}%`
                  )
                }
              >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Cost (lei)">
                  <input
                    className={inputClassName}
                    name="costLei"
                    defaultValue={product?.costLei ?? ""}
                    inputMode="decimal"
                    onChange={(event) => setCost(event.currentTarget.value)}
                  />
                </Field>
                <Field label="Vânzare (lei)">
                  <input
                    className={inputClassName}
                    name="salePriceLei"
                    defaultValue={product?.salePriceLei ?? ""}
                    inputMode="decimal"
                    // Gol = 2× cost: arătăm direct cât va fi.
                    placeholder={costValue > 0 ? `${formatLei(costValue * 2)} (automat)` : "2× cost"}
                    onChange={(event) => setSalePrice(event.currentTarget.value)}
                  />
                </Field>
              </div>
              </Section>

              <Section
                icon={Warehouse}
                title="Stoc"
                hint={`total ${calculateTotal(warehouseQuantities)} buc.`}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {warehouses.map((warehouse) => (
                    <div key={warehouse.id} className="grid gap-1.5">
                      <input name="warehouseId" type="hidden" value={warehouse.id} readOnly />
                      <Field label={warehouse.name}>
                        <input
                          className={inputClassName}
                          inputMode="numeric"
                          min={0}
                          name="warehouseQuantity"
                          type="number"
                          value={warehouseQuantities[warehouse.id] ?? "0"}
                          onChange={(event) => {
                            // React clears `currentTarget` once this handler returns.
                            // The state updater can run afterwards, so retain the value first.
                            const quantity = event.currentTarget.value;
                            setWarehouseQuantities((current) => ({
                              ...current,
                              [warehouse.id]: quantity,
                            }));
                          }}
                        />
                        {/* La editare: cât era înainte, ca să vezi ce schimbi. */}
                        {product && originalQuantities[warehouse.id] !== (warehouseQuantities[warehouse.id] ?? "0") ? (
                          <span className="text-xs font-medium text-(--c-amber)">era {originalQuantities[warehouse.id]}</span>
                        ) : null}
                      </Field>
                    </div>
                  ))}
                </div>
                {/* Stocul schimbat din fișă intră într-un document: inventar sau recepție. */}
                {stockChanged ? (
                  <div className="mt-3 grid gap-1.5">
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="De unde vine schimbarea de stoc">
                      {STOCK_REASONS.map(({ value, label, icon: Icon }) => (
                        <label
                          key={value}
                          className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-(--c-accent)/40 ${
                            stockReason === value
                              ? "border-(--c-accent) bg-(--c-accent-soft) text-(--c-accent-strong)"
                              : "border-(--c-line) text-(--c-ink-2) hover:bg-(--c-hover)"
                          }`}
                        >
                          <input
                            checked={stockReason === value}
                            className="sr-only"
                            name="stockReason"
                            required
                            type="radio"
                            value={value}
                            onChange={() => {
                              setStockReason(value);
                              setStockDocumentId("");
                            }}
                          />
                          <Icon className="size-4" aria-hidden="true" />
                          {label}
                        </label>
                      ))}
                    </div>
                    {stockReason && !(stockReason === "receipt" && stockDecreased) ? (
                      <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                        <Field label="În documentul">
                          <select
                            className={inputClassName}
                            name="stockDocumentId"
                            value={chosenDocument?.id ?? ""}
                            onChange={(event) => setStockDocumentId(event.currentTarget.value)}
                          >
                            <option value="">{stockReason === "inventory" ? "Inventarul de azi din fișe" : "Recepția de azi din fișe"}</option>
                            {targetDocuments.map((document) => (
                              <option key={document.id} value={document.id}>
                                {targetDocumentLabel(document)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {stockReason === "receipt" && !chosenDocument ? (
                          <Field label="Furnizor">
                            <select
                              className={inputClassName}
                              name="stockPartnerId"
                              value={stockTargets?.suppliers.some((supplier) => supplier.id === stockPartnerId) ? stockPartnerId : ""}
                              onChange={(event) => setStockPartnerId(event.currentTarget.value)}
                            >
                              <option value="">Fără furnizor</option>
                              {(stockTargets?.suppliers ?? []).map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                        ) : null}
                      </div>
                    ) : null}
                    <p
                      className={`text-xs ${
                        !stockReason ? "font-medium text-(--c-amber)" : stockReason === "receipt" && stockDecreased ? "font-medium text-(--c-red)" : "text-(--c-muted-2)"
                      }`}
                    >
                      {!stockReason
                        ? "Stocul s-a schimbat: alege dacă e inventar sau marfă adusă."
                        : stockReason === "inventory"
                          ? "Intră ca diferență față de sistem."
                          : stockDecreased
                            ? "La marfă adusă stocul doar crește. Pentru scădere alege Inventar."
                            : costValue > 0
                              ? `Intră la ${formatLei(costValue)} lei bucata.`
                              : "Intră fără cost: completează costul mai sus."}
                    </p>
                  </div>
                ) : null}
              </Section>

              {/* Ce se completează rar stă strâns; titlul spune câte câmpuri au
                  deja ceva scris, ca nimic să nu rămână ascuns fără să știi. */}
              <details className="group" data-modal-section>
                <summary className={`${modalSectionGridClassName} cursor-pointer list-none py-4 hover:bg-(--c-hover) [&::-webkit-details-marker]:hidden`}>
                  <SectionTitle
                    icon={SlidersHorizontal}
                    title="Mai multe"
                    hint={filledDetails > 0 ? `${filledDetails} completate` : undefined}
                  />
                  <span className="flex items-center justify-between gap-3 text-sm text-(--c-muted-2) lg:pt-1.5">
                    <span className="max-sm:hidden">cod alternativ, preț EUR, stoc minim, texte pentru site</span>
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </span>
                </summary>
                <div className={`${modalSectionGridClassName} pt-0`}>
                  <div className="grid gap-3 lg:col-start-2">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Field label="Cod alternativ">
                        <input
                          className={inputClassName}
                          name="alternativeCode"
                          defaultValue={product?.alternativeCode ?? ""}
                          placeholder="cod furnizor"
                        />
                      </Field>
                      <Field label="Preț EUR">
                        <input
                          className={inputClassName}
                          name="priceEuro"
                          defaultValue={product?.priceEuro ?? ""}
                          inputMode="decimal"
                        />
                      </Field>
                      <Field label="Stoc minim">
                        <input
                          className={inputClassName}
                          name="minStock"
                          defaultValue={product?.minStock ?? ""}
                          inputMode="numeric"
                          placeholder="3"
                        />
                      </Field>
                      <label className="flex items-center gap-2 self-end pb-2 text-sm text-(--c-ink-2)">
                        <input name="isLocal" type="checkbox" defaultChecked={product?.isLocal ?? false} />
                        Fabricată local
                      </label>
                    </div>
                    <Field label="Descriere în rusă">
                      <textarea
                        className={`${inputClassName} min-h-9 resize-y py-2`}
                        rows={1}
                        name="descriptionRu"
                        defaultValue={product?.descriptionRu ?? ""}
                        placeholder="ex. Левый порог для 4/5 дверей"
                      />
                    </Field>
                    {/*
                      Câmpul se numea „Notițe" și suna a notă internă, dar se publică
                      pe site-ul public, în fișa piesei. Eticheta o spune acum.
                    */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Mențiune pe site">
                        <textarea
                          className={`${inputClassName} min-h-14 resize-y py-2`}
                          name="notes"
                          defaultValue={product?.notes ?? ""}
                          placeholder="Public. Nu scrie note interne."
                        />
                      </Field>
                      <Field label="Mențiune pe site, în rusă">
                        <textarea
                          className={`${inputClassName} min-h-14 resize-y py-2`}
                          name="notesRu"
                          defaultValue={product?.notesRu ?? ""}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </details>
            </form>
          </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}

/**
 * Un rând din lista de compatibilități. Primul rând ESTE mașina principală a
 * produsului, deci trimite `brandId/modelId/yearStart/...`; restul trimit
 * perechea `extra*`, pe care serverul o citește pozițional — de aceea
 * „În continuare" rămâne un input ascuns, nu o bifă cu `name` (bifa nebifată
 * nu s-ar trimite și ar decala anii de pe rândurile următoare).
 */
function FitmentRow({
  brands,
  models,
  primary,
  value,
  onChange,
  onRemove,
}: {
  brands: CatalogFormOptions["brands"];
  models: CatalogFormOptions["models"];
  primary: boolean;
  value: ExtraFitmentValue;
  onChange: (patch: Partial<ExtraFitmentValue>) => void;
  /** Lipsă = rândul principal, care nu se poate șterge. */
  onRemove?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem_5.5rem_auto_2.25rem] sm:items-start">
      <input
        name={primary ? "yearOpenEnded" : "extraYearOpenEnded"}
        type="hidden"
        value={value.yearOpenEnded ? "1" : ""}
        readOnly
      />
      {/* Pe telefon: brandul și modelul pe toată lățimea, anii unul lângă altul. */}
      <Field label="Brand" className="max-sm:col-span-2">
        <BrandSelect
          brands={brands}
          name={primary ? "brandId" : undefined}
          required={primary}
          value={value.brandId}
          onChange={(brandId) => onChange({ brandId, modelId: "" })}
        />
      </Field>
      <Field label="Model" className="max-sm:col-span-2">
        <ModelSelect
          brands={brands}
          defaultBrandId={value.brandId}
          emptyLabel={value.brandId ? "Alege modelul" : "Alege întâi brandul"}
          models={models.filter((model) => model.brandId === value.brandId)}
          name={primary ? "modelId" : "extraModelId"}
          required={primary}
          value={value.modelId}
          onChange={(modelId) => onChange({ modelId })}
        />
      </Field>
      <Field label="Ani de la">
        <input
          className={inputClassName}
          inputMode="numeric"
          name={primary ? "yearStart" : "extraYearStart"}
          placeholder="1995"
          value={value.yearStart}
          onChange={(event) => onChange({ yearStart: event.target.value })}
        />
      </Field>
      <Field label="Până la">
        <input
          className={inputClassName}
          disabled={value.yearOpenEnded}
          inputMode="numeric"
          name={primary ? "yearEnd" : "extraYearEnd"}
          placeholder="2006"
          value={value.yearEnd}
          onChange={(event) => onChange({ yearEnd: event.target.value })}
        />
      </Field>
      <div className="flex items-center gap-3 sm:mt-7">
        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-(--c-ink-2)">
          <input
            checked={value.yearOpenEnded}
            type="checkbox"
            onChange={(event) =>
              onChange({
                yearOpenEnded: event.target.checked,
                yearEnd: event.target.checked ? "" : value.yearEnd,
              })
            }
          />
          și în prezent
        </label>
      </div>
      {onRemove ? (
        <button
          aria-label="Șterge compatibilitatea"
          className="button-danger grid size-9 place-items-center justify-self-end rounded-md border border-(--c-line) bg-(--c-surface) text-(--c-red) hover:border-(--c-red) hover:bg-(--c-red-soft) sm:mt-6 sm:justify-self-auto"
          title="Șterge mașina"
          type="button"
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function emptyFitment(): ExtraFitmentValue {
  return { brandId: "", modelId: "", yearStart: "", yearEnd: "", yearOpenEnded: false };
}

/** Prima poziție e compatibilitatea principală a produsului, apoi gemenii. */
function toFitments(product: ProductFormValue | undefined): ExtraFitmentValue[] {
  if (!product) return [emptyFitment()];
  return [
    {
      brandId: product.brandId,
      modelId: product.modelId,
      yearStart: product.yearStart,
      yearEnd: product.yearEnd,
      yearOpenEnded: product.yearOpenEnded,
    },
    ...product.extraFitments,
  ];
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid content-start gap-1 text-[13px] font-medium text-(--c-muted) ${className}`}>
      {label}
      {children}
    </label>
  );
}

const STOCK_REASONS: { value: StockReason; label: string; icon: typeof ClipboardCheck }[] = [
  { value: "inventory", label: "Inventar", icon: ClipboardCheck },
  { value: "receipt", label: "Marfă adusă", icon: PackagePlus },
];

function targetDocumentLabel(document: StockTargets["documents"][number]) {
  const [, month, day] = document.date.split("-");
  const name = document.kind === "inventory" ? "Inventar" : "Recepție";
  return `${name} #${document.number}, ${day}.${month}${document.partnerName ? `, ${document.partnerName}` : ""}`;
}

/** Opțiunea „+ Tip nou…" din lista de tipuri; serverul folosește atunci `newTypeName`. */
const NEW_TYPE = "__new";

const formatLei = (value: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(value);

const inputClassName =
  "field-control h-9 w-full rounded-md border border-(--c-line) bg-(--c-surface) px-2.5 text-sm outline-none placeholder:text-(--c-muted-2) disabled:bg-(--c-line-2)";

function getWarehouseQuantities(
  product: ProductFormValue | undefined,
  warehouses: Array<{ id: string; name: string }>,
) {
  const current = new Map(
    (product?.warehouseStocks ?? []).map((stock) => [stock.warehouseId, stock.quantity]),
  );

  return Object.fromEntries(
    warehouses.map((warehouse) => [warehouse.id, current.get(warehouse.id) ?? "0"]),
  );
}

function calculateTotal(quantities: Record<string, string>) {
  return Object.values(quantities).reduce((total, quantity) => {
    const parsed = Number(quantity);
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);
}
