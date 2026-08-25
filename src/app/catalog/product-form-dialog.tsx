"use client";

import { useState, type ReactNode } from "react";
import {
  createProductAction,
  updateProductAction,
  type CatalogActionState,
} from "@/app/catalog/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";
import {
  drawerBoundaryProps,
  drawerPanelClassName,
  useDrawerAction,
  useDrawerStackChild,
} from "@/app/components/operation-drawer";
import { BrandSelect, ModelSelect } from "@/app/admin/admin-dialogs";
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
  const action = product ? updateProductAction : createProductAction;
  // Fără resetul automat al React: la eroare rămâne tot completat.
  const { state, pending, onSubmit } = useDrawerAction(action, initialState, (saved) => {
    setOpen(false);
    setMounted(false);
    // Cel care a deschis dialogul primește produsul gata de selectat pe rândul
    // în lucru — altfel ar trebui să-l caute din nou după ce l-a creat.
    if (saved.created) onCreated?.(saved.created);
  });
  // Cât timp formularul ăsta e deschis, drawerul din care s-a plecat se ascunde.
  useDrawerStackChild(open);

  function setOpen(next: boolean) {
    if (!controlled) setSelfOpen(next);
    onOpenChange?.(next);
  }

  function initFields() {
    setFitments(toFitments(product));
    setWarehouseQuantities(getWarehouseQuantities(product, warehouses));
  }

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
              ? "button-secondary rounded-md border border-[#e8e7e3] px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
              : "button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
          }
          type="button"
          onClick={openDialog}
        >
          {triggerLabel}
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
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setOpen(false);
            }}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
              <div>
                <h2 className="text-2xl font-semibold text-[#1b1a17]">
                  {product ? "Editează produs" : "Adaugă produs"}
                </h2>
              </div>
              <button
                className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-medium text-[#1b1a17] hover:bg-[#f6f6f4]"
                type="button"
                onClick={() => setOpen(false)}
              >
                Închide
              </button>
            </div>

            <form onSubmit={onSubmit} className="grid gap-5 px-6 py-6">
              {product ? (
                <input name="productId" type="hidden" value={product.id} />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Cod">
                  <input
                    className={inputClassName}
                    name="externalCode"
                    defaultValue={product?.externalCode ?? ""}
                    placeholder="ex. P12013 1"
                  />
                </Field>
                <Field label="Cod alternativ">
                  <input
                    className={inputClassName}
                    name="alternativeCode"
                    defaultValue={product?.alternativeCode ?? ""}
                    placeholder="ex. cod furnizor"
                  />
                </Field>
                <Field label="Tip produs">
                  <select
                    className={inputClassName}
                    name="typeId"
                    defaultValue={product?.typeId ?? ""}
                  >
                    <option value="">Alege tipul</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tip produs nou">
                  <input
                    className={inputClassName}
                    name="newTypeName"
                    placeholder="Doar dacă nu există în listă"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Descriere">
                  <textarea
                    className={`${inputClassName} min-h-24 resize-y py-3`}
                    name="description"
                    defaultValue={product?.description ?? initialDescription ?? ""}
                    placeholder="ex. Prag 4/5uși L"
                    required
                  />
                </Field>
                <Field label="Descriere în rusă">
                  <textarea
                    className={`${inputClassName} min-h-24 resize-y py-3`}
                    name="descriptionRu"
                    defaultValue={product?.descriptionRu ?? ""}
                    placeholder="ex. Левый порог для 4/5 дверей"
                  />
                </Field>
              </div>

              {/*
                Câmpul se numea „Notițe" și suna a notă internă, dar se publică
                pe site-ul public, în fișa piesei. Eticheta o spune acum.
              */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mențiune publică (apare pe site)">
                  <textarea
                    className={`${inputClassName} min-h-20 resize-y py-3`}
                    name="notes"
                    defaultValue={product?.notes ?? ""}
                    placeholder="ex. Livrare în 2 zile. Nu scrie aici note interne."
                  />
                </Field>
                <Field label="Mențiune publică în rusă">
                  <textarea
                    className={`${inputClassName} min-h-20 resize-y py-3`}
                    name="notesRu"
                    defaultValue={product?.notesRu ?? ""}
                  />
                </Field>
              </div>

              <section className="rounded-xl border border-[#e8e7e3] bg-white p-4">
                <div>
                  <h3 className="font-semibold text-[#1b1a17]">Compatibilități</h3>
                  <p className="mt-1 text-xs text-[#6f6b63]">
                    Prima linie e mașina principală. Adaugă câte linii are piesa (Sprinter ↔ Crafter).
                  </p>
                </div>

                <div className="mt-4 grid gap-3">
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
                  className="button-secondary mt-3 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                  type="button"
                  onClick={addFitment}
                >
                  + Adaugă altă compatibilitate
                </button>
              </section>

              <label className="field-control flex items-center gap-2 self-start rounded-md border border-[#e8e7e3] bg-white px-3 py-3 text-sm text-[#33312c]">
                <input name="isLocal" type="checkbox" defaultChecked={product?.isLocal ?? false} />
                Piesă fabricată local (manufactura proprie)
              </label>

              <section className="rounded-xl border border-[#e8e7e3] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#1b1a17]">Stoc pe depozite</h3>
                    <p className="mt-1 text-xs text-[#6f6b63]">
                      Completează cantitatea reală din fiecare depozit. Totalul se calculează automat.
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[#1b1a17]">
                    Total: <span className="font-mono">{calculateTotal(warehouseQuantities)}</span> buc.
                  </p>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                      </Field>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Stoc minim (alertă) — gol = 3">
                  <input
                    className={inputClassName}
                    name="minStock"
                    defaultValue={product?.minStock ?? ""}
                    inputMode="numeric"
                    placeholder="3"
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
                <Field label="Cost aducere (lei)">
                  <input
                    className={inputClassName}
                    name="costLei"
                    defaultValue={product?.costLei ?? ""}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Preț vânzare (lei) — gol = 2× cost">
                  <input
                    className={inputClassName}
                    name="salePriceLei"
                    defaultValue={product?.salePriceLei ?? ""}
                    inputMode="decimal"
                    placeholder="automat din cost"
                  />
                </Field>
              </div>

              {state.message ? (
                <div
                  className={`rounded-md border px-3 py-2 text-sm ${
                    state.ok
                      ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
                      : "border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]"
                  }`}
                >
                  {state.message}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 border-t border-[#e8e7e3] pt-5">
                <button
                  className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-4 py-2.5 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Anulează
                </button>
                <SubmitButton label={product ? "Salvează" : "Adaugă"} pending={pending} />
              </div>
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
    <div className="grid gap-3 rounded-md border border-[#efeeeb] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_8rem_13rem] lg:items-start">
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
      <div className="flex items-center gap-3 lg:mt-7">
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-[#33312c]">
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
          În continuare
        </label>
        {onRemove ? (
          <button
            aria-label="Șterge compatibilitatea"
            className="button-danger rounded-md border border-[#e8e7e3] bg-white px-2 py-2 text-sm font-semibold text-[#991b1b] hover:border-[#dc2626] hover:bg-[#fef2f2]"
            type="button"
            onClick={onRemove}
          >
            Șterge
          </button>
        ) : null}
      </div>
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
    <label className={`grid content-start gap-1.5 text-sm font-medium text-[#33312c] ${className}`}>
      {label}
      {children}
    </label>
  );
}

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {

  return (
    <button
      className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Se salvează..." : label}
    </button>
  );
}

const inputClassName =
  "field-control h-11 w-full rounded-md border border-[#e8e7e3] bg-white px-3 text-sm outline-none placeholder:text-[#98948b] disabled:bg-[#f0efec]";

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
