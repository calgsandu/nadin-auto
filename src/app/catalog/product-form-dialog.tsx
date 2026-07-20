"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { Brand, CarModel, ProductType } from "@/generated/prisma/client";
import {
  createProductAction,
  updateProductAction,
  type CatalogActionState,
} from "@/app/catalog/actions";
import { DrawerPortal } from "@/app/components/drawer-portal";

type ProductFormDialogProps = {
  brands: Brand[];
  models: CarModel[];
  types: ProductType[];
  warehouses: Array<{ id: string; name: string }>;
  product?: ProductFormValue;
  triggerLabel: string;
  triggerKind?: "primary" | "row";
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
}: ProductFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [modelId, setModelId] = useState(product?.modelId ?? "");
  const [newBrandName, setNewBrandName] = useState("");
  const [warehouseQuantities, setWarehouseQuantities] = useState<Record<string, string>>(
    () => getWarehouseQuantities(product, warehouses),
  );
  const [yearOpenEnded, setYearOpenEnded] = useState(
    product?.yearOpenEnded ?? false,
  );
  const action = product ? updateProductAction : createProductAction;
  const [state, formAction] = useActionState(action, initialState);
  const filteredModels = useMemo(() => {
    if (!brandId || newBrandName.trim()) {
      return [];
    }

    return models.filter((model) => model.brandId === brandId);
  }, [brandId, models, newBrandName]);

  function openDialog() {
    setBrandId(product?.brandId ?? "");
    setModelId(product?.modelId ?? "");
    setNewBrandName("");
    setYearOpenEnded(product?.yearOpenEnded ?? false);
    setWarehouseQuantities(getWarehouseQuantities(product, warehouses));
    setOpen(true);
  }

  return (
    <>
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

      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            className="absolute inset-0 cursor-default"
            type="button"
            aria-label="Închide formularul"
            onClick={() => setOpen(false)}
          />
          <aside className="motion-drawer-panel relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-[#fafaf9] shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e7e3] bg-[#fafaf9] px-6 py-5">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#6f6b63]">
                  Catalog
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#1b1a17]">
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

            <form action={formAction} className="grid gap-5 px-6 py-6">
              {product ? (
                <input name="productId" type="hidden" value={product.id} />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Brand existent">
                  <select
                    className={inputClassName}
                    name="brandId"
                    value={newBrandName.trim() ? "" : brandId}
                    disabled={Boolean(newBrandName.trim())}
                    onChange={(event) => {
                      setBrandId(event.target.value);
                      setModelId("");
                    }}
                  >
                    <option value="">Alege brandul</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Brand nou">
                  <input
                    className={inputClassName}
                    name="newBrandName"
                    value={newBrandName}
                    onChange={(event) => {
                      setNewBrandName(event.target.value);
                      setModelId("");
                    }}
                    placeholder="Completează doar dacă nu există"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Model existent">
                  <select
                    className={inputClassName}
                    name="modelId"
                    value={newBrandName.trim() ? "" : modelId}
                    disabled={Boolean(newBrandName.trim())}
                    onChange={(event) => setModelId(event.target.value)}
                  >
                    <option value="">
                      {brandId ? "Alege modelul" : "Alege întâi brandul"}
                    </option>
                    {filteredModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Model nou">
                  <input
                    className={inputClassName}
                    name="newModelName"
                    placeholder="Completează doar dacă nu există"
                  />
                </Field>
              </div>

              <Field label="Tip produs nou">
                <input
                  className={inputClassName}
                  name="newTypeName"
                  placeholder="Completează doar dacă nu există în listă"
                />
              </Field>

              <Field label="Descriere">
                <textarea
                  className={`${inputClassName} min-h-24 resize-y py-3`}
                  name="description"
                  defaultValue={product?.description ?? ""}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Notițe">
                  <textarea
                    className={`${inputClassName} min-h-20 resize-y py-3`}
                    name="notes"
                    defaultValue={product?.notes ?? ""}
                  />
                </Field>
                <Field label="Notițe în rusă">
                  <textarea
                    className={`${inputClassName} min-h-20 resize-y py-3`}
                    name="notesRu"
                    defaultValue={product?.notesRu ?? ""}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Ani de la">
                  <input
                    className={inputClassName}
                    name="yearStart"
                    defaultValue={product?.yearStart ?? ""}
                    inputMode="numeric"
                    placeholder="1995"
                  />
                </Field>
                <Field label="Ani până la">
                  <input
                    className={inputClassName}
                    name="yearEnd"
                    defaultValue={product?.yearEnd ?? ""}
                    disabled={yearOpenEnded}
                    inputMode="numeric"
                    placeholder="2006"
                  />
                </Field>
                <label className="field-control flex items-center gap-2 self-end rounded-md border border-[#e8e7e3] bg-white px-3 py-3 text-sm text-[#33312c]">
                  <input
                    name="yearOpenEnded"
                    type="checkbox"
                    checked={yearOpenEnded}
                    onChange={(event) => setYearOpenEnded(event.target.checked)}
                  />
                  În continuare
                </label>
              </div>

              <label className="field-control flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3 py-3 text-sm text-[#33312c]">
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

              <div className="grid gap-4 sm:grid-cols-3">
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
              </div>

              <Field label="Preț vânzare (lei) — gol = automat (2× cost, rotunjit la 50)">
                <input
                  className={inputClassName}
                  name="salePriceLei"
                  defaultValue={product?.salePriceLei ?? ""}
                  inputMode="decimal"
                  placeholder="se calculează automat din cost"
                />
              </Field>

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
                <SubmitButton label={product ? "Salvează" : "Adaugă"} />
              </div>
            </form>
          </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#33312c]">
      {label}
      {children}
    </label>
  );
}

function SubmitButton({ label }: { label: string }) {
  const status = useFormStatus();

  return (
    <button
      className="button-primary rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Se salvează..." : label}
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
