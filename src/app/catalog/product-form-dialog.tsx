"use client";

import { useRef, useState, type ReactNode } from "react";
import { Banknote, Car, ChevronDown, ListPlus, PackageSearch, Pencil, Plus, Printer, Tag, Trash2, Warehouse } from "lucide-react";
import {
  createProductAction,
  updateProductAction,
  type CatalogActionState,
} from "@/app/catalog/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { CloseIconButton, IconLabel, rowIconButtonCls, SaveIconButton } from "@/app/components/icon-buttons";
import {
  DrawerCard,
  drawerBoundaryProps,
  drawerPanelClassName,
  handleEnterNavigation,
  useDrawerAction,
  useDrawerStackChild,
} from "@/app/components/operation-drawer";
import { BrandSelect, ModelSelect } from "@/app/admin/admin-dialogs";
import { ProductCodeField } from "@/app/catalog/product-code-field";
import type { ProductSearchResult } from "@/lib/catalog/product-search";

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
  triggerKind?: "primary" | "row";
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
  // Cât timp formularul ăsta e deschis, drawerul din care s-a plecat se ascunde.
  useDrawerStackChild(open);

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
  const costValue = Number(cost.replace(",", ".")) || 0;
  const saleValue = Number(salePrice.replace(",", ".")) || 0;
  const effectiveSale = saleValue || costValue * 2;
  const margin = costValue > 0 && effectiveSale > 0 ? Math.round(((effectiveSale - costValue) / effectiveSale) * 100) : null;
  const hasDetails = Boolean(
    product?.alternativeCode ||
      product?.priceEuro ||
      product?.minStock ||
      product?.isLocal ||
      product?.descriptionRu ||
      product?.notes ||
      product?.notesRu,
  );

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
              : "button-primary button-add inline-flex items-center gap-1.5 rounded-md bg-[#18181b] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#27272a]"
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
          ) : (
            triggerLabel
          )}
        </button>
      )}

      {mounted ? (
        <DrawerPortal locked={open}>
          <div
            className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30"
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
            className={drawerPanelClassName}
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
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#e4e4e7] bg-[#fafafa] px-5 py-3">
              <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[#18181b]">
                <span className="grid size-8 place-items-center rounded-lg bg-[#18181b] text-white">
                  <PackageSearch className="size-4" aria-hidden="true" />
                </span>
                {product ? "Editează produs" : "Adaugă produs"}
              </h2>
              <div className="flex items-center gap-2">
                {/* Doar la produs nou, deschis direct (nu din vânzare/recepție). */}
                {!product && !controlled ? (
                  <button
                    className="button-secondary hidden size-9 items-center justify-center rounded-md border border-[#e4e4e7] bg-white text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#18181b] disabled:opacity-60 sm:inline-flex"
                    disabled={pending}
                    title="Salvează și adaugă altul"
                    aria-label="Salvează și adaugă altul"
                    type="button"
                    onClick={() => submit(true)}
                  >
                    <ListPlus className="size-4.5" aria-hidden="true" />
                  </button>
                ) : null}
                <SaveIconButton
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
              className="grid gap-5 px-5 py-4"
              onKeyDown={(event) => handleEnterNavigation(event)}
            >
              {product ? (
                <input name="productId" type="hidden" value={product.id} />
              ) : null}

              {lastSaved ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f0fdf4] px-3 py-2 text-sm text-[#166534]">
                  <span className="min-w-0 truncate">Salvat: {lastSaved.label}</span>
                  <div className="flex items-center gap-2">
                    <a
                      className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#bbf7d0] bg-white px-3 py-1.5 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
                      href={`/print/labels?items=${lastSaved.id}:${Math.max(lastSaved.copies, 1)}&layout=grid`}
                      rel="noopener"
                      target="_blank"
                    >
                      <Printer className="size-4" aria-hidden="true" /> Sticker ({Math.max(lastSaved.copies, 1)})
                    </a>
                    <button
                      aria-label="Ascunde"
                      className="grid size-8 place-items-center rounded-md hover:bg-[#dcfce7]"
                      type="button"
                      onClick={() => setLastSaved(null)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Ordinea în care se scrie o piesă: codul, ce e, ce tip. */}
              <DrawerCard icon={Tag} title="Piesa">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[12rem_minmax(0,1fr)_14rem]">
                <Field label="Cod">
                  <ProductCodeField
                    className={inputClassName}
                    defaultValue={product?.externalCode ?? ""}
                    productId={product?.id}
                  />
                </Field>
                <Field label="Descriere">
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
              </DrawerCard>

              <DrawerCard
                icon={Car}
                title="Se potrivește pe"
                action={
                  <button
                    className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-sm font-semibold text-[#18181b] hover:bg-[#f4f4f5]"
                    type="button"
                    onClick={addFitment}
                  >
                    <Plus className="size-4" aria-hidden="true" /> Altă mașină
                  </button>
                }
              >
                <div className="grid gap-1.5">
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
              </DrawerCard>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <DrawerCard icon={Banknote} title="Preț">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Cost (lei)">
                  <input
                    className={inputClassName}
                    name="costLei"
                    defaultValue={product?.costLei ?? ""}
                    inputMode="decimal"
                    onChange={(event) => setCost(event.currentTarget.value)}
                  />
                </Field>
                <Field label="Preț vânzare (lei)">
                  <input
                    className={inputClassName}
                    name="salePriceLei"
                    defaultValue={product?.salePriceLei ?? ""}
                    inputMode="decimal"
                    // Gol = 2× cost: arătăm direct cât va fi.
                    placeholder={costValue > 0 ? `${formatLei(costValue * 2)} (automat)` : "automat: 2× cost"}
                    onChange={(event) => setSalePrice(event.currentTarget.value)}
                  />
                  {margin !== null ? (
                    <span className={`text-xs font-normal ${margin < 0 ? "font-medium text-[#b91c1c]" : "text-[#71717a]"}`}>
                      {margin < 0 ? "sub cost" : `marjă ${margin}%`}
                    </span>
                  ) : null}
                </Field>
              </div>
              </DrawerCard>

              <DrawerCard
                icon={Warehouse}
                title="Stoc pe depozite"
                action={
                  <p className="text-sm text-[#52525b]">
                    Total <span className="font-semibold tabular-nums text-[#18181b]">{calculateTotal(warehouseQuantities)}</span> buc.
                  </p>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
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
                          <span className="text-xs font-medium text-[#b45309]">era {originalQuantities[warehouse.id]}</span>
                        ) : null}
                      </Field>
                    </div>
                  ))}
                </div>
              </DrawerCard>
              </div>

              {/* Ce se completează rar stă strâns; se deschide singur când produsul
                  are deja ceva scris aici. */}
              <details className="group rounded-lg border border-[#e4e4e7] bg-white" open={hasDetails || undefined}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-[#18181b] [&::-webkit-details-marker]:hidden">
                  <span>
                    Mai multe detalii
                    <span className="ml-2 font-normal text-[#71717a]">cod alternativ, preț EUR, stoc minim, site</span>
                  </span>
                  <ChevronDown className="size-4 text-[#71717a] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="grid gap-3 border-t border-[#f0f0f2] p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Cod alternativ">
                    <input
                      className={inputClassName}
                      name="alternativeCode"
                      defaultValue={product?.alternativeCode ?? ""}
                      placeholder="ex. cod furnizor"
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
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-[#3f3f46]">
                    <input name="isLocal" type="checkbox" defaultChecked={product?.isLocal ?? false} />
                    Fabricată local
                  </label>
                  <Field className="sm:col-span-2" label="Descriere în rusă">
                    <textarea
                      className={`${inputClassName} min-h-14 resize-y py-2`}
                      name="descriptionRu"
                      defaultValue={product?.descriptionRu ?? ""}
                      placeholder="ex. Левый порог для 4/5 дверей"
                    />
                  </Field>
                  {/*
                    Câmpul se numea „Notițe" și suna a notă internă, dar se publică
                    pe site-ul public, în fișa piesei. Eticheta o spune acum.
                  */}
                  <Field label="Mențiune publică (apare pe site)">
                    <textarea
                      className={`${inputClassName} min-h-14 resize-y py-2`}
                      name="notes"
                      defaultValue={product?.notes ?? ""}
                      placeholder="Nu scrie aici note interne."
                    />
                  </Field>
                  <Field label="Mențiune publică în rusă">
                    <textarea
                      className={`${inputClassName} min-h-14 resize-y py-2`}
                      name="notesRu"
                      defaultValue={product?.notesRu ?? ""}
                    />
                  </Field>
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
    <div className="grid gap-2 rounded-lg border border-[#ececef] bg-[#fafafa] px-2.5 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem_6.5rem_8.5rem_2.25rem] lg:items-start">
      <input
        name={primary ? "yearOpenEnded" : "extraYearOpenEnded"}
        type="hidden"
        value={value.yearOpenEnded ? "1" : ""}
        readOnly
      />
      <Field label="Brand">
        <BrandSelect
          brands={brands}
          name={primary ? "brandId" : undefined}
          required={primary}
          value={value.brandId}
          onChange={(brandId) => onChange({ brandId, modelId: "" })}
        />
      </Field>
      <Field label="Model">
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
      <div className="flex items-center gap-3 lg:mt-8">
        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-[#3f3f46]">
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
          className="button-danger grid size-9 place-items-center rounded-md border border-[#e4e4e7] bg-white text-[#991b1b] hover:border-[#dc2626] hover:bg-[#fef2f2] lg:mt-6"
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
    <label className={`grid content-start gap-1 text-[13px] font-medium text-[#52525b] ${className}`}>
      {label}
      {children}
    </label>
  );
}

/** Opțiunea „+ Tip nou…" din lista de tipuri; serverul folosește atunci `newTypeName`. */
const NEW_TYPE = "__new";

const formatLei = (value: number) => new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(value);

const inputClassName =
  "field-control h-9 w-full rounded-md border border-[#e4e4e7] bg-white px-2.5 text-sm outline-none placeholder:text-[#71717a] disabled:bg-[#f1f1f3]";

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
