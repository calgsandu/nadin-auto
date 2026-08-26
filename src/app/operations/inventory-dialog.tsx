"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  createInventoryAction,
  type OperationActionState,
} from "@/app/operations/actions";
import {
  DrawerField,
  DrawerFooter,
  DrawerSection,
  OperationDrawer,
  focusFirstLineSearch,
  handleEnterNavigation,
  useDrawerAction,
  drawerDangerButton,
  drawerFormClassName,
  drawerInputClassName,
  drawerLineClassName,
  drawerSecondaryButton,
} from "@/app/components/operation-drawer";
import { useDrawerDraft } from "@/app/components/use-drawer-draft";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import {
  AddedLinesFilter,
  LabelStickerCell,
  StickerPrintButton,
  matchesLineFilter,
} from "@/app/operations/drawer-line-tools";
import { formatDateInputValue } from "@/lib/operations/date-input";
import type { WarehouseOption } from "@/app/operations/stock-document-dialog";
import { quantityAfterSelect } from "@/lib/operations/default-quantity";

const initialState: OperationActionState = { ok: false, message: "" };

type InventoryLine = {
  id: number;
  productId: string;
  label: string;
  counted: string;
  sticker: boolean;
  copies: string;
};

const emptyLine = (id: number): InventoryLine => ({
  id,
  productId: "",
  label: "",
  counted: "",
  sticker: false,
  copies: "",
});

export function InventoryDialog({
  warehouses,
  defaultWarehouseId,
}: {
  warehouses: WarehouseOption[];
  defaultWarehouseId?: string;
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<InventoryLine[]>([emptyLine(1)]);
  const [filter, setFilter] = useState("");
  function resetLines() {
    nextLineId.current = 2;
    setLines([emptyLine(1)]);
    setFilter("");
  }
  const draft = useDrawerDraft({
    kind: "inventory",
    lines,
    setLines: (restored) => {
      nextLineId.current = restored.reduce((max, line) => Math.max(max, line.id), 0) + 1;
      setLines(restored);
    },
    reset: resetLines,
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(
    createInventoryAction,
    initialState,
    () => {
      setOpen(false);
      setMounted(false);
      resetLines();
      draft.clear();
    },
  );
  const today = useMemo(() => formatDateInputValue(new Date()), []);

  function addLine() {
    const id = nextLineId.current;
    nextLineId.current += 1;
    // Rândul nou intră sus, lângă buton: la inventarele lungi nu mai trebuie
    // derulat până la capăt după fiecare produs.
    setLines((current) => [emptyLine(id), ...current]);
    focusFirstLineSearch();
  }

  function removeLine(id: number) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function patchLine(id: number, patch: Partial<InventoryLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  return (
    <>
      <button
        className="button-primary rounded-md bg-[#1b1a17] px-3 py-2 text-sm font-semibold text-white hover:bg-[#33312c]"
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        Corectează stocul
      </button>
      {mounted ? (
        <OperationDrawer
          title="Inventar"
          open={open}
          pending={pending}
          submitLabel="Salvează inventarul"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
            <input name="idempotencyKey" type="hidden" value={draft.token} />
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
                <div className="flex flex-wrap items-center gap-2">
                  <AddedLinesFilter value={filter} onChange={setFilter} />
                  <StickerPrintButton lines={lines} />
                  <button className={drawerSecondaryButton} type="button" onClick={addLine}>
                    <Plus className="size-4" aria-hidden="true" /> Adaugă produs
                  </button>
                </div>
              }
            >
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className={`${drawerLineClassName} md:grid-cols-[minmax(0,1fr)_8rem_11rem_2.75rem]`}
                  style={matchesLineFilter(filter, line) ? undefined : { display: "none" }}
                >
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-[#6f6b63]">Produs {index + 1}</p>
                    <ProductSearchCombobox
                      showHint={false}
                      initialProduct={
                        line.productId ? { id: line.productId, label: line.label } : null
                      }
                      excludedProductIds={lines
                        .filter((item) => item.id !== line.id)
                        .map((item) => item.productId)}
                      onSelect={(product) =>
                        patchLine(line.id, {
                          productId: product.id,
                          label: product.label,
                          counted: quantityAfterSelect(product.id),
                        })
                      }
                      onClear={() =>
                        patchLine(line.id, { productId: "", label: "", counted: "" })
                      }
                    />
                  </div>
                  <DrawerField label="Numărat (buc)">
                    <input
                      className={drawerInputClassName}
                      inputMode="numeric"
                      min={0}
                      name="countedQuantity"
                      required
                      type="number"
                      value={line.counted}
                      onChange={(event) => patchLine(line.id, { counted: event.currentTarget.value })}
                    />
                  </DrawerField>
                  <LabelStickerCell
                    index={index}
                    defaultCopies={line.counted}
                    line={line}
                    onChange={(patch) => patchLine(line.id, patch)}
                  />
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

            <DrawerFooter
              onCancel={() => setOpen(false)}
              pending={pending}
              submitLabel="Salvează inventarul"
            />
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}
