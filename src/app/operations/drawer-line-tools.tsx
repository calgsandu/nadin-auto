"use client";

import { Search } from "lucide-react";
import { AddToStickersButton } from "@/app/catalog/add-to-stickers";
import { DrawerField, drawerSecondaryButton } from "@/app/components/operation-drawer";
import {
  countStickers,
  matchesLineFilter,
  stickerAdditions,
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
      <div className="flex h-9 items-center gap-2 rounded-md border border-(--c-line) bg-(--c-surface) px-2.5">
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
          className="field-control h-7 w-14 rounded border border-(--c-line) bg-(--c-surface) px-2 text-sm outline-none disabled:bg-(--c-hover) disabled:text-(--c-muted-2)"
          data-enter-skip
          disabled={!line.sticker}
          inputMode="numeric"
          min={1}
          type="number"
          value={line.copies ?? ""}
          onChange={(event) => onChange({ copies: event.currentTarget.value })}
        />
        <span className="text-xs text-(--c-muted)">buc</span>
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
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-(--c-muted)"
        aria-hidden="true"
      />
      <input
        aria-label="Caută în produsele adăugate"
        className="field-control h-9 w-56 rounded-md border border-(--c-line) bg-(--c-surface) pl-8 pr-3 text-sm outline-none placeholder:text-(--c-muted-2)"
        data-enter-skip
        placeholder="Caută în cele adăugate"
        type="search"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

/** „Stickere (N)" — pune rândurile bifate în lista comună de stickere. */
export function StickerAddButton({ lines }: { lines: StickerLine[] }) {
  return (
    <AddToStickersButton
      className={`${drawerSecondaryButton} disabled:opacity-60`}
      items={stickerAdditions(lines)}
      label={`Stickere (${countStickers(lines)})`}
    />
  );
}
