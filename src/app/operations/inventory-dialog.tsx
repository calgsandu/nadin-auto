"use client";

import { ClipboardCheck, FileText, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  createInventoryAction,
  type OperationActionState,
} from "@/app/operations/actions";
import {
  DrawerCard,
  DrawerField,
  DrawerSection,
  OperationDrawer,
  focusFirstLineSearch,
  handleEnterNavigation,
  useDrawerAction,
  useOpenFromUrl,
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
  /** Stocul din sistem pe depozite (din căutare): arată diferența pe loc. */
  stocks?: { warehouseId: string; quantity: number }[];
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
  openFromUrl,
}: {
  warehouses: WarehouseOption[];
  defaultWarehouseId?: string;
  /** true = se deschide singur când adresa are `?nou=1` (vezi `useOpenFromUrl`). */
  openFromUrl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: ciorna nesalvată nu se pierde.
  const [mounted, setMounted] = useState(false);
  useOpenFromUrl(openFromUrl, () => {
    setMounted(true);
    setOpen(true);
  });
  const nextLineId = useRef(2);
  const [lines, setLines] = useState<InventoryLine[]>([emptyLine(1)]);
  const [filter, setFilter] = useState("");
  // Depozitul numărat: diferența „numărat − sistem" se calculează față de el.
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ?? warehouses[0]?.id ?? "");
  function resetLines() {
    nextLineId.current = 2;
    setLines([emptyLine(1)]);
    setFilter("");
  }
  const draft = useDrawerDraft({
    kind: "inventory",
    lines: { lines, warehouseId },
    setLines: (restored) => {
      // Ciornele vechi erau doar lista de rânduri, fără depozit.
      const value = restored as unknown;
      const restoredLines = Array.isArray(value) ? (value as InventoryLine[]) : restored.lines;
      nextLineId.current = restoredLines.reduce((max, line) => Math.max(max, line.id), 0) + 1;
      setLines(restoredLines);
      if (!Array.isArray(value) && restored.warehouseId) setWarehouseId(restored.warehouseId);
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

  /** Ce era în sistem în depozitul numărat; null = rând fără produs sau ciornă veche. */
  function systemQuantity(line: InventoryLine) {
    if (!line.productId || !line.stocks) return null;
    return line.stocks.find((stock) => stock.warehouseId === warehouseId)?.quantity ?? 0;
  }
  // Rezumatul de deasupra listei: verifici diferențele înainte să salvezi.
  const summary = lines.reduce(
    (total, line) => {
      if (!line.productId) return total;
      total.products += 1;
      const system = systemQuantity(line);
      const counted = Number(line.counted);
      if (system === null || line.counted === "" || !Number.isFinite(counted)) return total;
      const difference = counted - system;
      if (difference > 0) total.plus += difference;
      if (difference < 0) total.minus -= difference;
      return total;
    },
    { products: 0, plus: 0, minus: 0 },
  );

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
        className="button-primary rounded-md bg-[#18181b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#27272a]"
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
          icon={ClipboardCheck}
          open={open}
          pending={pending}
          submitLabel="Salvează inventarul"
          draft={draft.banner}
          onClose={() => setOpen(false)}
        >
          <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
            <input name="idempotencyKey" type="hidden" value={draft.token} />
            <DrawerCard
              icon={FileText}
              title="Detalii"
              action={
                summary.products > 0 ? (
                  <p className="flex flex-wrap items-center gap-x-3 text-sm text-[#52525b]">
                    <span>
                      <span className="font-semibold tabular-nums text-[#18181b]">{summary.products}</span> produse
                    </span>
                    <span className="font-semibold tabular-nums text-[#166534]">+{summary.plus} buc.</span>
                    <span className="font-semibold tabular-nums text-[#b91c1c]">−{summary.minus} buc.</span>
                    <span className="text-[#71717a]">față de sistem</span>
                  </p>
                ) : null
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <DrawerField label="Depozitul numărat">
                  <select
                    className={drawerInputClassName}
                    name="warehouseId"
                    required
                    value={warehouseId}
                    onChange={(event) => setWarehouseId(event.currentTarget.value)}
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </select>
                </DrawerField>
                <DrawerField label="Data">
                  <input className={drawerInputClassName} defaultValue={today} name="documentDate" type="date" />
                </DrawerField>
              </div>
            </DrawerCard>

            <DrawerSection
              title={`Produse numărate${summary.products > 0 ? ` (${summary.products})` : ""}`}
              icon={ClipboardCheck}
              description="Scrie cât ai numărat fizic — diferența o calculează sistemul."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <AddedLinesFilter value={filter} onChange={setFilter} />
                  <StickerPrintButton lines={lines} />
                  <button className={drawerSecondaryButton} type="button" onClick={addLine}>
                    <Plus className="size-4" aria-hidden="true" /> Produs
                  </button>
                </div>
              }
            >
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className={`${drawerLineClassName} md:grid-cols-[minmax(0,1fr)_11rem_11rem_2.25rem]`}
                  style={matchesLineFilter(filter, line) ? undefined : { display: "none" }}
                >
                  <div>
                    <p className="line-label mb-1 text-[13px] font-medium leading-5 text-[#52525b]">Produs</p>
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
                          stocks: product.stocks ?? [],
                        })
                      }
                      onClear={() =>
                        patchLine(line.id, { productId: "", label: "", counted: "", stocks: undefined })
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
                    <CountDifference system={systemQuantity(line)} counted={line.counted} />
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

            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-[#52525b] hover:text-[#18181b] [&::-webkit-details-marker]:hidden">
                <Plus className="size-4 group-open:rotate-45" aria-hidden="true" /> Notițe
              </summary>
              <textarea
                aria-label="Notițe"
                className={`${drawerInputClassName} mt-2 min-h-16 resize-y py-2`}
                name="notes"
                placeholder="cine a numărat, observații"
              />
            </details>
          </form>
        </OperationDrawer>
      ) : null}
    </>
  );
}

/** Sub cantitatea numărată: cât era în sistem și diferența, colorată. */
function CountDifference({ system, counted }: { system: number | null; counted: string }) {
  if (system === null) return null;
  const value = Number(counted);
  if (counted === "" || !Number.isFinite(value)) {
    return <span className="text-xs font-normal text-[#71717a]">în sistem: {system}</span>;
  }
  const difference = value - system;
  if (difference === 0) {
    return <span className="text-xs font-normal text-[#71717a]">la fel ca în sistem</span>;
  }
  return (
    <span className={`text-xs font-medium ${difference > 0 ? "text-[#166534]" : "text-[#b91c1c]"}`}>
      {difference > 0 ? `+${difference}` : `−${-difference}`} față de sistem ({system})
    </span>
  );
}
