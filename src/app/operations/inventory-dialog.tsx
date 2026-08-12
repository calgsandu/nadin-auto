"use client";

import { Plus, Printer, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
  focusFirstLineSearch,
  handleEnterNavigation,
  useDrawerAction,
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
  const { state, pending, onSubmit } = useDrawerAction(
    createInventoryAction,
    initialState,
    () => {
      setOpen(false);
      setMounted(false);
      nextLineId.current = 2;
      setLines([emptyLine(1)]);
      setFilter("");
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

  const needle = filter.trim().toLowerCase();
  /** Rândurile filtrate rămân montate (doar ascunse) — altfel s-ar pierde din formular. */
  const isVisible = (line: InventoryLine) =>
    !needle || !line.productId || line.label.toLowerCase().includes(needle);

  const stickerItems = lines.filter((line) => line.sticker && line.productId);
  const stickerCount = stickerItems.reduce(
    (sum, line) => sum + (Number(line.copies) || 0),
    0,
  );

  function printLabels() {
    const items = stickerItems
      .map((line) => `${line.productId}:${Math.max(Number(line.copies) || 1, 1)}`)
      .join(",");
    window.open(`/print/labels?items=${items}&layout=grid`, "_blank");
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
          eyebrow="Document stoc"
          title="Inventar"
          open={open}
          pending={pending}
          submitLabel="Salvează inventarul"
          onClose={() => setOpen(false)}
        >
          <form onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
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
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#6f6b63]"
                      aria-hidden="true"
                    />
                    <input
                      aria-label="Caută în produsele adăugate"
                      className="field-control h-9 w-56 rounded-md border border-[#e8e7e3] bg-white pl-8 pr-3 text-sm outline-none placeholder:text-[#98948b]"
                      data-enter-skip
                      placeholder="Caută în cele adăugate"
                      type="search"
                      value={filter}
                      onChange={(event) => setFilter(event.currentTarget.value)}
                    />
                  </div>
                  <button
                    className={drawerSecondaryButton}
                    disabled={stickerCount === 0}
                    type="button"
                    onClick={printLabels}
                  >
                    <Printer className="size-4" aria-hidden="true" /> Etichete ({stickerCount})
                  </button>
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
                  style={isVisible(line) ? undefined : { display: "none" }}
                >
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-[#6f6b63]">Produs {index + 1}</p>
                    <ProductSearchCombobox
                      showHint={false}
                      excludedProductIds={lines
                        .filter((item) => item.id !== line.id)
                        .map((item) => item.productId)}
                      onSelect={(product) =>
                        patchLine(line.id, { productId: product.id, label: product.label })
                      }
                      onClear={() => patchLine(line.id, { productId: "", label: "" })}
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
                  <DrawerField label="Etichete">
                    <div className="flex h-11 items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3">
                      <input
                        aria-label={`Etichetă pentru produsul ${index + 1}`}
                        checked={line.sticker}
                        className="size-4"
                        data-enter-skip
                        type="checkbox"
                        onChange={(event) => {
                          const sticker = event.currentTarget.checked;
                          // La bifare pornim de la cantitatea numărată; se poate schimba.
                          patchLine(line.id, {
                            sticker,
                            copies: sticker ? line.copies || line.counted || "1" : line.copies,
                          });
                        }}
                      />
                      <input
                        aria-label={`Câte etichete pentru produsul ${index + 1}`}
                        className="field-control h-8 w-16 rounded border border-[#e8e7e3] bg-white px-2 text-sm outline-none disabled:bg-[#f6f6f4] disabled:text-[#98948b]"
                        data-enter-skip
                        disabled={!line.sticker}
                        inputMode="numeric"
                        min={1}
                        type="number"
                        value={line.copies}
                        onChange={(event) => patchLine(line.id, { copies: event.currentTarget.value })}
                      />
                      <span className="text-xs text-[#6f6b63]">buc</span>
                    </div>
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
