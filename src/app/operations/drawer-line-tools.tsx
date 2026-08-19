"use client";

import { Printer, Search } from "lucide-react";
import { DrawerField, drawerSecondaryButton } from "@/app/components/operation-drawer";
import {
  buildStickerItems,
  countStickers,
  matchesLineFilter,
  type StickerLine,
} from "@/lib/operations/stickers";

export { matchesLineFilter };

export type { StickerLine } from "@/lib/operations/stickers";

/** Bifă + număr de etichete pe rândul unui produs (inventar, editare document). */
export function LabelStickerCell({
  index,
  line,
  defaultCopies,
  onChange,
}: {
  index: number;
  line: StickerLine;
  /** Cu ce număr pornește la bifare (inventar: cantitatea numărată). */
  defaultCopies?: string;
  onChange: (patch: { sticker?: boolean; copies?: string }) => void;
}) {
  return (
    <DrawerField label="Etichete">
      <div className="flex h-11 items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3">
        <input
          aria-label={`Etichetă pentru produsul ${index + 1}`}
          checked={Boolean(line.sticker)}
          className="size-4"
          data-enter-skip
          type="checkbox"
          onChange={(event) => {
            const sticker = event.currentTarget.checked;
            // La bifare pornim de la cantitatea rândului; se poate schimba.
            onChange({
              sticker,
              copies: sticker ? line.copies || defaultCopies || "1" : line.copies,
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
          value={line.copies ?? ""}
          onChange={(event) => onChange({ copies: event.currentTarget.value })}
        />
        <span className="text-xs text-[#6f6b63]">buc</span>
      </div>
    </DrawerField>
  );
}

/** Căutare peste produsele deja adăugate în document (nu ascunde rândurile goale). */
export function AddedLinesFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
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
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

/**
 * Butonul „Etichete (N)" — deschide printul pentru rândurile bifate.
 * Link real, nu `window.open`: popupurile programatice sunt blocate în
 * Chromium-urile hardened (Helium), unde butonul părea pur și simplu mort.
 */
export function StickerPrintButton({ lines }: { lines: StickerLine[] }) {
  const total = countStickers(lines);
  const items = buildStickerItems(lines);
  if (!total || !items) {
    return (
      <span aria-disabled="true" className={`${drawerSecondaryButton} opacity-60`}>
        <Printer className="size-4" aria-hidden="true" /> Etichete (0)
      </span>
    );
  }
  return (
    <a
      className={drawerSecondaryButton}
      href={`/print/labels?items=${items}&layout=grid`}
      rel="noopener"
      target="_blank"
    >
      <Printer className="size-4" aria-hidden="true" /> Etichete ({total})
    </a>
  );
}
