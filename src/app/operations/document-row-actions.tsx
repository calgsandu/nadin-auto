"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ActionFeedback } from "@/app/components/action-feedback";
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
import {
  deleteDocumentAction,
  updateDocumentLinesAction,
  type DocumentActionState,
} from "@/app/operations/document-actions";
import type { SupplierOption } from "@/app/operations/stock-document-dialog";

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
type EditableLine = DocLine & { id: number };

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
  suppliers = [],
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
  lines: DocLine[];
  isInventory: boolean;
};

function EditDrawer(props: EditProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary rounded-md border border-[#e8e7e3] px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
      >
        Editează
      </button>
      {open ? <EditPanel {...props} setOpen={setOpen} /> : null}
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
  lines,
  isInventory,
  setOpen,
}: EditProps & { setOpen: (v: boolean) => void }) {
  const [state, formAction] = useActionState(updateDocumentLinesAction, initial);
  const [editableLines, setEditableLines] = useState<EditableLine[]>(() =>
    lines.length > 0
      ? lines.map((line, index) => ({
          ...line,
          id: index + 1,
          quantity: normalizeQuantity(line.quantity, isInventory),
        }))
      : [{ id: 1, productId: "", label: "", quantity: "", price: "" }],
  );
  const [nextLineId, setNextLineId] = useState(editableLines.length + 1);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok, setOpen]);

  function addLine() {
    const id = nextLineId;
    setNextLineId(id + 1);
    setEditableLines((current) => [
      ...current,
      { id, productId: "", label: "", quantity: "", price: "" },
    ]);
  }

  function removeLine(id: number) {
    setEditableLines((current) => current.filter((line) => line.id !== id));
  }

  function setLineField(
    id: number,
    field: "quantity" | "price" | "externalName" | "externalCode" | "externalCost",
    value: string,
  ) {
    setEditableLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  return (
    <OperationDrawer
      eyebrow="Document stoc"
      title={title}
      onClose={() => setOpen(false)}
    >
      <form action={formAction} className={drawerFormClassName} onKeyDown={(event) => handleEnterNavigation(event, addLine)}>
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-4 md:grid-cols-2">
          <DrawerField label={isInventory ? "Data inventarului" : "Data documentului"}>
            <input className={drawerInputClassName} name="documentDate" type="date" defaultValue={documentDate} />
          </DrawerField>
          {isInventory ? null : documentType === "RECEIPT" ? (
            <DrawerField label="Furnizor">
              <select
                className={drawerInputClassName}
                defaultValue={partnerId}
                disabled={suppliers.length === 0}
                name="partnerId"
              >
                <option value="">
                  {suppliers.length > 0 ? "Alege furnizorul" : "Nu există furnizori"}
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </DrawerField>
          ) : (
            <DrawerField label="Partener">
              <input className={drawerInputClassName} name="partnerName" defaultValue={partnerName} placeholder="opțional" />
            </DrawerField>
          )}
        </div>

        <DrawerSection
          title={isInventory ? "Poziții ajustate" : "Produse"}
          description={
            isInventory
              ? "Diferența față de stocul din sistem: plus fără semn, minus cu „-”."
              : "Cantitate și preț în lei."
          }
          action={
            <button className={drawerSecondaryButton} type="button" onClick={addLine}>
              <Plus className="size-4" aria-hidden="true" />
              Adaugă produs
            </button>
          }
        >
          {editableLines.map((line, index) => {
            const isExternal = !line.productId && Boolean(line.externalName);
            return (
              <div
                key={line.id}
                className={`${drawerLineClassName} ${
                  isExternal
                    ? "border-[#dbebfe] md:grid-cols-[minmax(0,1fr)_7rem_7rem_8rem_2.75rem]"
                    : isInventory
                      ? "md:grid-cols-[minmax(0,1fr)_10rem_2.75rem]"
                      : "md:grid-cols-[minmax(0,1fr)_7rem_8rem_2.75rem]"
                }`}
              >
                <div>
                  <p className={`mb-1.5 text-xs font-semibold ${isExternal ? "text-[#175cd3]" : "text-[#6f6b63]"}`}>
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
                          onChange={(event) => setLineField(line.id, "externalName", event.currentTarget.value)}
                        />
                        <input
                          className={drawerInputClassName}
                          name="lineExternalCode"
                          placeholder="cod piesă"
                          value={line.externalCode ?? ""}
                          onChange={(event) => setLineField(line.id, "externalCode", event.currentTarget.value)}
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
                        initialProduct={
                          line.productId ? { id: line.productId, label: line.label } : null
                        }
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
                    onChange={(event) => setLineField(line.id, "quantity", event.currentTarget.value)}
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
                      onChange={(event) => setLineField(line.id, "externalCost", event.currentTarget.value)}
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
                      onChange={(event) => setLineField(line.id, "price", event.currentTarget.value)}
                    />
                  </DrawerField>
                )}
                <button
                  aria-label={`Șterge produsul ${index + 1}`}
                  className={drawerDangerButton}
                  disabled={editableLines.length === 1}
                  type="button"
                  onClick={() => removeLine(line.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
          {editableLines.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#e8e7e3] px-3 py-6 text-center text-sm text-[#6f6b63]">
              Adaugă cel puțin un produs.
            </div>
          ) : null}
        </DrawerSection>

        <DrawerField label="Notițe">
          <textarea
            className={`${drawerInputClassName} min-h-24 resize-y py-3`}
            name="notes"
            defaultValue={notes}
          />
        </DrawerField>

        <DrawerMessage state={state} />
        <DrawerFooter onCancel={() => setOpen(false)} submitLabel="Salvează" />
      </form>
    </OperationDrawer>
  );
}

function DeleteForm({ id, title }: { id: string; title: string }) {
  const [state, formAction] = useActionState(deleteDocumentAction, initial);
  return (
    <form className="grid justify-items-end gap-1" action={formAction} onSubmit={(e) => { if (!window.confirm(`Ștergi ${title}? Stocul va fi reversat.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <DeleteButton />
      <ActionFeedback state={state} compact />
    </form>
  );
}

function DeleteButton() {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} className="button-secondary rounded-md border border-[#fca5a5] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-60">
      {status.pending ? "..." : "Șterge"}
    </button>
  );
}
