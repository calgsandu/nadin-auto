"use client";

import { ClipboardCheck, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { memo, useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { ActionFeedback } from "@/app/components/action-feedback";
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
import { pruneDrafts, useDrawerDraft } from "@/app/components/use-drawer-draft";
import { textHash } from "@/lib/operations/draft-storage";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import { SupplierPicker } from "@/app/partners/supplier-picker";
import {
  AddedLinesFilter,
  LabelStickerCell,
  StickerPrintButton,
  matchesLineFilter,
} from "@/app/operations/drawer-line-tools";
import {
  deleteDocumentAction,
  updateDocumentLinesAction,
  type DocumentActionState,
} from "@/app/operations/document-actions";
import type {
  SupplierOption,
  WarehouseOption,
} from "@/app/operations/stock-document-dialog";
import { quantityAfterSelect } from "@/lib/operations/default-quantity";
import { DeleteIconSubmit } from "@/app/components/delete-icon-submit";
import { IconLabel, rowIconButtonCls } from "@/app/components/icon-buttons";

const initial: DocumentActionState = { ok: false, message: "" };

export type DocLine = {
  productId: string;
  label: string;
  quantity: string;
  price: string;
  /** Linie externă (piesă de la furnizor, fără produs în catalog). */
  externalName?: string;
  externalCode?: string;
  externalSupplierId?: string;
  externalCost?: string;
};
type EditableLine = DocLine & {
  id: number;
  /** Etichete de printat pentru rândul ăsta (doar client, nu se salvează). */
  sticker?: boolean;
  copies?: string;
};

/** Inventarul se editează pe diferența cu semn; restul documentelor pe cantități pozitive. */
function normalizeQuantity(quantity: string, keepSign: boolean) {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed) || parsed === 0) return "";
  return String(keepSign ? parsed : Math.abs(parsed));
}

export function DocumentRowActions({
  id,
  title,
  documentDate,
  documentType,
  notes,
  partnerId,
  partnerName,
  warehouseId = "",
  suppliers = [],
  warehouses = [],
  lines = [],
  isTransfer = false,
}: {
  id: string;
  title: string;
  documentDate: string;
  documentType: string;
  notes: string;
  partnerId: string;
  partnerName: string;
  suppliers?: SupplierOption[];
  /** Depozitele între care se poate muta documentul (recepții și inventare). */
  warehouses?: WarehouseOption[];
  warehouseId?: string;
  lines?: DocLine[];
  /** Jumătate de transfer: fără editare pe linii; ștergerea elimină ambele jumătăți. */
  isTransfer?: boolean;
}) {
  // Ajustările (inventar) se editează pe diferențe cu semn — transferurile, tot
  // ADJUSTMENT, nu ajung aici: editarea lor e blocată mai jos.
  const isInventory = documentType === "ADJUSTMENT";

  return (
    <div className="flex justify-end gap-2">
      {!isTransfer ? (
        <EditDrawer
          id={id}
          documentDate={documentDate}
          documentType={documentType}
          lines={lines}
          notes={notes}
          partnerId={partnerId}
          partnerName={partnerName}
          suppliers={suppliers}
          warehouses={warehouses}
          warehouseId={warehouseId}
          title={title}
          isInventory={isInventory}
        />
      ) : null}
      <DeleteForm
        id={id}
        title={isTransfer ? `${title} (transfer — se șterg ambele jumătăți)` : title}
      />
    </div>
  );
}

type EditProps = {
  id: string;
  title: string;
  documentDate: string;
  documentType: string;
  notes: string;
  partnerId: string;
  partnerName: string;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  warehouseId: string;
  lines: DocLine[];
  isInventory: boolean;
};

function EditDrawer(props: EditProps) {
  const [open, setOpen] = useState(false);
  // Panoul rămâne montat după prima deschidere: modificările nesalvate
  // se regăsesc la redeschidere, nu se pierd la închiderea din greșeală.
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        title="Editează"
        className={rowIconButtonCls}
      >
        <Pencil aria-hidden="true" />
        <IconLabel>Editează</IconLabel>
      </button>
      {mounted ? (
        <EditPanel {...props} open={open} setOpen={setOpen} onSaved={() => setMounted(false)} />
      ) : null}
    </>
  );
}

function EditPanel({
  id,
  title,
  documentDate,
  documentType,
  notes,
  partnerId,
  partnerName,
  suppliers,
  warehouses,
  warehouseId,
  lines,
  isInventory,
  open,
  setOpen,
  onSaved,
}: EditProps & { open: boolean; setOpen: (v: boolean) => void; onSaved: () => void }) {
  const savedLines = useMemo<EditableLine[]>(
    () =>
      lines.length > 0
        ? lines.map((line, index) => ({
            ...line,
            id: index + 1,
            quantity: normalizeQuantity(line.quantity, isInventory),
          }))
        : [{ id: 1, productId: "", label: "", quantity: "", price: "" }],
    [lines, isInventory],
  );
  const [editableLines, setEditableLines] = useState<EditableLine[]>(savedLines);
  const [nextLineId, setNextLineId] = useState(editableLines.length + 1);
  const [filter, setFilter] = useState("");
  // Ciorna e per document: modificările neterminate la #12 nu au ce căuta la #13.
  // Rândurile primesc id-uri noi la recuperare, ca fișele de produs să se refacă.
  // Ciorna ține de versiunea documentului de pe server: dacă între timp l-a
  // salvat altcineva (alt calculator), ciorna veche nu se mai recuperează —
  // altfel la „Salvează" ar șterge tăcut modificările celuilalt.
  const version = useMemo(
    () => textHash(JSON.stringify([lines, documentDate, notes, warehouseId, partnerId, partnerName])),
    [lines, documentDate, notes, warehouseId, partnerId, partnerName],
  );
  const draftKind = `doc-edit:${id}:${version}`;
  useEffect(() => {
    // Ciornele versiunilor vechi ale documentului: sute de KB fiecare la un
    // inventar mare, și nu mai pot fi recuperate oricum.
    pruneDrafts(`doc-edit:${id}`, draftKind);
  }, [id, draftKind]);
  const draft = useDrawerDraft({
    kind: draftKind,
    lines: editableLines,
    setLines: (restored) => {
      setEditableLines(restored.map((line, index) => ({ ...line, id: nextLineId + index })));
      setNextLineId(nextLineId + restored.length);
    },
    reset: () => {
      setEditableLines(savedLines);
      setNextLineId(savedLines.length + 1);
      setFilter("");
    },
  });
  const { attachForm } = draft;
  const { pending, onSubmit } = useDrawerAction(
    updateDocumentLinesAction,
    initial,
    () => {
      setOpen(false);
      draft.clear();
      onSaved();
    },
  );

  function addLine() {
    const id = nextLineId;
    setNextLineId(id + 1);
    setEditableLines((current) => [
      { id, productId: "", label: "", quantity: "", price: "" },
      ...current,
    ]);
    focusFirstLineSearch();
  }

  const removeLine = useCallback((id: number) => {
    setEditableLines((current) => current.filter((line) => line.id !== id));
  }, []);

  const patchLine = useCallback((id: number, patch: Partial<EditableLine>) => {
    setEditableLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }, []);

  // Produsele deja puse pe rânduri (să nu fie alese de două ori). Se schimbă doar
  // când se schimbă setul de produse, nu la fiecare cifră: altfel toate rândurile
  // se redesenează la fiecare tastă (Inventar #1 are ~950).
  const selectedKey = editableLines.map((line) => line.productId).join(",");
  const selectedProductIds = useMemo(() => selectedKey.split(",").filter(Boolean), [selectedKey]);

  return (
    <OperationDrawer
      title={title}
      open={open}
      pending={pending}
      submitLabel="Salvează"
      draft={draft.banner}
      onClose={() => setOpen(false)}
    >
      <form ref={attachForm} onSubmit={onSubmit} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-4 md:grid-cols-2">
          <DrawerField label={isInventory ? "Data inventarului" : "Data documentului"}>
            <input className={drawerInputClassName} name="documentDate" type="date" defaultValue={documentDate} />
          </DrawerField>
          {warehouses.length > 0 && (documentType === "RECEIPT" || documentType === "ADJUSTMENT") ? (
            <DrawerField
              label="Depozit"
              hint="Mutarea readuce stocul în depozitul vechi și îl aplică în cel nou."
            >
              <select className={drawerInputClassName} defaultValue={warehouseId} name="warehouseId">
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </DrawerField>
          ) : null}
          {isInventory ? null : documentType === "RECEIPT" ? (
            <DrawerField label="Furnizor">
              <SupplierPicker
                className={drawerInputClassName}
                defaultValue={partnerId}
                name="partnerId"
                suppliers={suppliers}
              />
            </DrawerField>
          ) : (
            <DrawerField label="Partener">
              <input className={drawerInputClassName} name="partnerName" defaultValue={partnerName} placeholder="opțional" />
            </DrawerField>
          )}
        </div>

        <DrawerSection
          title={isInventory ? "Poziții ajustate" : "Produse"}
          icon={isInventory ? ClipboardCheck : Package}
          description={
            isInventory ? "Diferența față de stocul din sistem: plus fără semn, minus cu „-”." : undefined
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <AddedLinesFilter value={filter} onChange={setFilter} />
              <StickerPrintButton lines={editableLines} />
              <button className={drawerSecondaryButton} type="button" onClick={addLine}>
                <Plus className="size-4" aria-hidden="true" />
                Adaugă produs
              </button>
            </div>
          }
        >
          {editableLines.map((line, index) => (
            <EditLineRow
              key={line.id}
              line={line}
              index={index}
              isInventory={isInventory}
              hidden={!matchesLineFilter(filter, line)}
              selectedProductIds={selectedProductIds}
              canRemove={editableLines.length > 1}
              onPatch={patchLine}
              onRemove={removeLine}
            />
          ))}
          {editableLines.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#e4e4e7] px-3 py-6 text-center text-sm text-[#52525b]">
              Adaugă cel puțin un produs.
            </div>
          ) : null}
        </DrawerSection>

        <DrawerField label="Notițe">
          <textarea
            className={`${drawerInputClassName} min-h-16 resize-y py-2`}
            name="notes"
            defaultValue={notes}
          />
        </DrawerField>

        <DrawerFooter onCancel={() => setOpen(false)} pending={pending} submitLabel="Salvează" />
      </form>
    </OperationDrawer>
  );
}

/**
 * Un rând din editarea unui document. E `memo`: Inventar #1 are ~950 de rânduri,
 * iar fără el fiecare tastă redesena tot panoul (și calcula pentru fiecare rând
 * lista celorlalte 949 de produse) — secunde de blocaj la o singură cifră.
 */
const EditLineRow = memo(function EditLineRow({
  line,
  index,
  isInventory,
  hidden,
  selectedProductIds,
  canRemove,
  onPatch,
  onRemove,
}: {
  line: EditableLine;
  index: number;
  isInventory: boolean;
  hidden: boolean;
  selectedProductIds: string[];
  canRemove: boolean;
  onPatch: (id: number, patch: Partial<EditableLine>) => void;
  onRemove: (id: number) => void;
}) {
  const isExternal = !line.productId && Boolean(line.externalName);
  return (
    <div
      className={`${drawerLineClassName} ${
        isExternal
          ? "line-keep-labels border-[#dbeafe] md:grid-cols-[minmax(0,1fr)_7rem_7rem_8rem_2.25rem]"
          : isInventory
            ? "md:grid-cols-[minmax(0,1fr)_8rem_11rem_2.25rem]"
            : "md:grid-cols-[minmax(0,1fr)_7rem_8rem_11rem_2.25rem]"
      }`}
      style={hidden ? { display: "none" } : undefined}
    >
      <div>
        <p className={`line-label mb-1 text-xs font-semibold leading-5 ${isExternal ? "text-[#1d4ed8]" : "text-[#52525b]"}`}>
          {isExternal ? `Piesă externă ${index + 1} (nu intră în stoc)` : `Produs ${index + 1}`}
        </p>
        {isExternal ? (
          <>
            <input name="lineProductId" type="hidden" value="" />
            <input name="lineExternalSupplierId" type="hidden" value={line.externalSupplierId ?? ""} />
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem]">
              <input
                className={drawerInputClassName}
                name="lineExternalName"
                required
                value={line.externalName ?? ""}
                onChange={(event) => onPatch(line.id, { externalName: event.currentTarget.value })}
              />
              <input
                className={drawerInputClassName}
                name="lineExternalCode"
                placeholder="cod piesă"
                value={line.externalCode ?? ""}
                onChange={(event) => onPatch(line.id, { externalCode: event.currentTarget.value })}
              />
            </div>
          </>
        ) : (
          <>
            <input name="lineExternalName" type="hidden" value="" />
            <input name="lineExternalCode" type="hidden" value="" />
            <input name="lineExternalSupplierId" type="hidden" value="" />
            <input name="lineExternalCostLei" type="hidden" value="" />
            <ProductSearchCombobox
              name="lineProductId"
              showHint={false}
              initialProduct={line.productId ? { id: line.productId, label: line.label } : null}
              // ponytail: include și produsul rândului; căutarea nu rulează cât
              // rândul are produs, iar „șterge" îl scoate din listă.
              excludedProductIds={selectedProductIds}
              onSelect={(product) =>
                onPatch(line.id, {
                  productId: product.id,
                  label: product.label,
                  quantity: quantityAfterSelect(product.id),
                })
              }
              onClear={() => onPatch(line.id, { productId: "", label: "", quantity: "" })}
            />
          </>
        )}
      </div>
      <DrawerField label={isInventory ? "Diferență (buc)" : "Cantitate"}>
        <input
          className={drawerInputClassName}
          name="lineQuantity"
          type="number"
          {...(isInventory ? {} : { min: 1 })}
          value={line.quantity}
          onChange={(event) => onPatch(line.id, { quantity: event.currentTarget.value })}
        />
      </DrawerField>
      {isExternal ? (
        <DrawerField label="Cost lei">
          <input
            className={drawerInputClassName}
            name="lineExternalCostLei"
            type="number"
            min={0}
            step="0.01"
            value={line.externalCost ?? ""}
            placeholder="achiziție"
            onChange={(event) => onPatch(line.id, { externalCost: event.currentTarget.value })}
          />
        </DrawerField>
      ) : null}
      {isInventory ? (
        <input name="linePrice" type="hidden" value="" />
      ) : (
        <DrawerField label="Preț lei">
          <input
            className={drawerInputClassName}
            name="linePrice"
            type="number"
            min={0}
            step="0.01"
            value={line.price}
            placeholder="preț"
            onChange={(event) => onPatch(line.id, { price: event.currentTarget.value })}
          />
        </DrawerField>
      )}
      {isExternal ? null : (
        <LabelStickerCell
          index={index}
          defaultCopies={line.quantity.replace("-", "")}
          line={line}
          onChange={(patch) => onPatch(line.id, patch)}
        />
      )}
      <button
        aria-label={`Șterge produsul ${index + 1}`}
        className={drawerDangerButton}
        disabled={!canRemove}
        type="button"
        onClick={() => onRemove(line.id)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
});

function DeleteForm({ id, title }: { id: string; title: string }) {
  const [state, formAction] = useActionState(deleteDocumentAction, initial);
  return (
    <form className="grid justify-items-end gap-1" action={formAction} onSubmit={(e) => { if (!window.confirm(`Ștergi ${title}? Stocul va fi reversat.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <DeleteIconSubmit />
      <ActionFeedback state={state} />
    </form>
  );
}

