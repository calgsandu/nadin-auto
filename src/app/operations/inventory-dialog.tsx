"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import {
  createInventoryAction,
  type OperationActionState,
} from "@/app/operations/actions";
import {
  DrawerField,
  DrawerFooter,
  DrawerMessage,
  DrawerSection,
  OperationDrawer,
  handleEnterNavigation,
  drawerDangerButton,
  drawerFormClassName,
  drawerInputClassName,
  drawerLineClassName,
  drawerSecondaryButton,
} from "@/app/components/operation-drawer";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import { formatDateInputValue } from "@/lib/operations/date-input";
import type { WarehouseOption } from "@/app/operations/stock-document-dialog";

const initialState: OperationActionState = { ok: false, message: "" };

export function InventoryDialog({
  warehouses,
  defaultWarehouseId,
}: {
  warehouses: WarehouseOption[];
  defaultWarehouseId?: string;
}) {
  const [open, setOpen] = useState(false);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState([{ id: 1 }]);
  async function inventoryAction(previousState: OperationActionState, formData: FormData) {
    const nextState = await createInventoryAction(previousState, formData);
    if (nextState.ok) {
      setOpen(false);
      nextLineId.current = 2;
      setLines([{ id: 1 }]);
    }
    return nextState;
  }
  const [state, formAction] = useActionState(inventoryAction, initialState);
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  function addLine() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    setLines((current) => [...current, { id }]);
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  return (
    <>
      <button
        className="button-primary rounded-md bg-[#1b1a17] px-3 py-2 text-sm font-semibold text-white hover:bg-[#33312c]"
        type="button"
        onClick={() => setOpen(true)}
      >
        Corectează stocul
      </button>
      {open ? (
        <OperationDrawer eyebrow="Document stoc" title="Inventar" onClose={() => setOpen(false)}>
          <form action={formAction} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
            <div className="grid gap-4 md:grid-cols-2">
              <DrawerField label="Data inventarului">
                <input className={drawerInputClassName} defaultValue={today} name="documentDate" type="date" />
              </DrawerField>
              <DrawerField label="Depozitul inventariat">
                <select
                  className={drawerInputClassName}
                  defaultValue={defaultWarehouseId ?? warehouses[0]?.id ?? ""}
                  name="warehouseId"
                  required
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </DrawerField>
            </div>

            <DrawerSection
              title="Produse numărate"
              description="Scrie cantitatea NUMĂRATĂ fizic — sistemul calculează singur diferența și o ajustează."
              action={
                <button className={drawerSecondaryButton} type="button" onClick={addLine}>
                  <Plus className="size-4" aria-hidden="true" /> Adaugă produs
                </button>
              }
            >
              {lines.map((line, index) => (
                <div key={line.id} className={`${drawerLineClassName} md:grid-cols-[minmax(0,1fr)_10rem_2.75rem]`}>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-[#6f6b63]">Produs {index + 1}</p>
                    <ProductSearchCombobox showHint={false} />
                  </div>
                  <DrawerField label="Numărat (buc)">
                    <input
                      className={drawerInputClassName}
                      inputMode="numeric"
                      min={0}
                      name="countedQuantity"
                      required
                      type="number"
                    />
                  </DrawerField>
                  <button
                    aria-label={`Șterge produsul ${index + 1}`}
                    className={drawerDangerButton}
                    disabled={lines.length === 1}
                    type="button"
                    onClick={() => removeLine(line.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </DrawerSection>

            <DrawerField label="Notițe">
              <textarea
                className={`${drawerInputClassName} min-h-24 resize-y py-3`}
                name="notes"
                placeholder="cine a numărat, observații"
              />
            </DrawerField>

            <DrawerMessage state={state} />
            <DrawerFooter onCancel={() => setOpen(false)} submitLabel="Salvează inventarul" />
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
