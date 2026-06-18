"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { ProductSearchCombobox } from "@/app/operations/product-search-combobox";
import {
  deleteDocumentAction,
  updateDocumentLinesAction,
  type DocumentActionState,
} from "@/app/operations/document-actions";
import type { SupplierOption } from "@/app/operations/stock-document-dialog";

const initial: DocumentActionState = { ok: false, message: "" };
const inputClassName =
  "h-11 w-full rounded-md border border-[#d8d2c6] bg-white px-3 text-sm text-[#1d2521] outline-none focus:border-[#c6a635] focus:ring-2 focus:ring-[#c6a635]/30";

export type DocLine = { productId: string; label: string; quantity: string; price: string };
type EditableLine = DocLine & { id: number };

function normalizeQuantity(quantity: string) {
  const parsed = Number(quantity);
  return Number.isFinite(parsed) && parsed !== 0 ? String(Math.abs(parsed)) : "";
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
}) {
  return (
    <div className="flex justify-end gap-2">
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
      />
      <DeleteForm id={id} title={title} />
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
};

function EditDrawer(props: EditProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary rounded-md border border-[#d8d2c6] px-3 py-1.5 text-xs font-semibold text-[#1d2521] hover:bg-[#f4f2ec]"
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
  setOpen,
}: EditProps & { setOpen: (v: boolean) => void }) {
  const [state, formAction] = useActionState(updateDocumentLinesAction, initial);
  const [editableLines, setEditableLines] = useState<EditableLine[]>(() =>
    lines.length > 0
      ? lines.map((line, index) => ({
          ...line,
          id: index + 1,
          quantity: normalizeQuantity(line.quantity),
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

  function setLineField(id: number, field: "quantity" | "price", value: string) {
    setEditableLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  }

  return (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
            <button className="absolute inset-0 cursor-default" type="button" aria-label="Închide" onClick={() => setOpen(false)} />
            <aside className="motion-drawer-panel relative flex h-full w-full max-w-4xl flex-col overflow-y-auto bg-[#f8f6f1] shadow-xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#d8d2c6] bg-[#f8f6f1] px-6 py-5">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#68746d]">Document</p>
                  <h2 className="mt-2 text-xl font-semibold text-[#1d2521]">{title}</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="button-secondary rounded-md border border-[#d8d2c6] bg-white px-3 py-2 text-sm font-medium text-[#1d2521] hover:bg-[#f4f2ec]">
                  Închide
                </button>
              </div>
              <form action={formAction} className="grid gap-4 px-6 py-6">
                <input type="hidden" name="id" value={id} />
                <label className="grid gap-1.5 text-sm font-medium text-[#2f3a34]">
                  Data
                  <input className={inputClassName} name="documentDate" type="date" defaultValue={documentDate} />
                </label>
                {documentType === "RECEIPT" ? (
                  <label className="grid gap-1.5 text-sm font-medium text-[#2f3a34]">
                    Furnizor
                    <select
                      className={inputClassName}
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
                  </label>
                ) : (
                  <label className="grid gap-1.5 text-sm font-medium text-[#2f3a34]">
                    Partener
                    <input className={inputClassName} name="partnerName" defaultValue={partnerName} placeholder="opțional" />
                  </label>
                )}
                <label className="grid gap-1.5 text-sm font-medium text-[#2f3a34]">
                  Note
                  <textarea className={`${inputClassName} min-h-20 resize-y py-3`} name="notes" defaultValue={notes} />
                </label>

                <section className="overflow-visible rounded-md border border-[#d8d2c6] bg-white">
                  <div className="flex items-center justify-between gap-4 border-b border-[#d8d2c6] bg-[#f4f2ec] px-3 py-3">
                    <p className="text-sm font-semibold text-[#1d2521]">Produse (cantitate + preț lei)</p>
                    <button
                      className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#d8d2c6] bg-white px-3 py-2 text-sm font-semibold text-[#1d2521] hover:bg-[#f8f6f1]"
                      type="button"
                      onClick={addLine}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Adaugă produs
                    </button>
                  </div>
                  <div className="grid gap-3 p-3">
                    {editableLines.map((line, index) => (
                      <div
                        key={line.id}
                        className="motion-line-item grid gap-3 rounded-md border border-[#e7e2d8] bg-[#fbfaf7] p-3 md:grid-cols-[minmax(0,1fr)_5rem_8rem_2.75rem] md:items-start"
                      >
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-[#68746d]">
                            Produs {index + 1}
                          </p>
                          <ProductSearchCombobox
                            name="lineProductId"
                            showHint={false}
                            initialProduct={
                              line.productId ? { id: line.productId, label: line.label } : null
                            }
                          />
                        </div>
                        <label className="grid gap-1.5 text-xs font-semibold text-[#68746d]">
                          Cantitate
                          <input
                            className="h-11 rounded-md border border-[#d8d2c6] bg-white px-2 text-sm text-[#1d2521] outline-none focus:border-[#c6a635] focus:ring-2 focus:ring-[#c6a635]/30"
                            name="lineQuantity"
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(event) => setLineField(line.id, "quantity", event.currentTarget.value)}
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-[#68746d]">
                          Preț lei
                          <input
                            className="h-11 rounded-md border border-[#d8d2c6] bg-white px-2 text-sm text-[#1d2521] outline-none focus:border-[#c6a635] focus:ring-2 focus:ring-[#c6a635]/30"
                            name="linePrice"
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.price}
                            placeholder="preț"
                            onChange={(event) => setLineField(line.id, "price", event.currentTarget.value)}
                          />
                        </label>
                        <button
                          aria-label={`Șterge produsul ${index + 1}`}
                          className="button-danger mt-6 grid size-11 place-items-center rounded-md border border-[#d8d2c6] bg-white text-[#8b3d2c] hover:border-[#c95f47] hover:bg-[#fff1eb] disabled:cursor-not-allowed disabled:opacity-35"
                          disabled={editableLines.length === 1}
                          type="button"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    {editableLines.length === 0 ? (
                      <div className="rounded-md border border-dashed border-[#d8d2c6] px-3 py-6 text-center text-sm text-[#68746d]">
                        Adaugă cel puțin un produs.
                      </div>
                    ) : null}
                    </div>
                </section>

                {state.message && !state.ok ? (
                  <div className="rounded-md border border-[#d6a28b] bg-[#fff1eb] px-3 py-2 text-sm text-[#7a2f13]">{state.message}</div>
                ) : null}
                <div className="flex justify-end gap-3 border-t border-[#d8d2c6] pt-5">
                  <button type="button" onClick={() => setOpen(false)} className="button-secondary rounded-md border border-[#d8d2c6] bg-white px-4 py-2.5 text-sm font-semibold text-[#1d2521] hover:bg-[#f4f2ec]">Anulează</button>
                  <SaveButton />
                </div>
              </form>
            </aside>
          </div>
        </DrawerPortal>
  );
}

function SaveButton() {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} className="button-primary rounded-md bg-[#202d27] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2c3a33] disabled:opacity-60">
      {status.pending ? "Se salvează..." : "Salvează"}
    </button>
  );
}

function DeleteForm({ id, title }: { id: string; title: string }) {
  const [state, formAction] = useActionState(deleteDocumentAction, initial);
  useEffect(() => {
    if (state.message && !state.ok) window.alert(state.message);
  }, [state]);
  return (
    <form action={formAction} onSubmit={(e) => { if (!window.confirm(`Ștergi ${title}? Stocul va fi reversat.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <DeleteButton />
    </form>
  );
}

function DeleteButton() {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} className="button-secondary rounded-md border border-[#d6a28b] px-3 py-1.5 text-xs font-semibold text-[#7a2f13] hover:bg-[#fff1eb] disabled:opacity-60">
      {status.pending ? "..." : "Șterge"}
    </button>
  );
}
