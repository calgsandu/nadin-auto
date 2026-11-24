"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  hydrateLabelSelection,
  toggleLabelSelection,
  type LabelSelectionItem,
} from "@/app/catalog/label-selection";
import { updateStickers, useStickers } from "@/app/catalog/sticker-store";

function itemFromBox(box: HTMLInputElement): LabelSelectionItem {
  return {
    id: box.dataset.labelId!,
    code: box.dataset.labelCode ?? "",
    alternativeCode: box.dataset.labelAlternativeCode ?? "",
    name: box.dataset.labelName ?? "",
    compatibility: box.dataset.labelCompatibility ?? "",
    count: 1,
    includeAlternativeCode: false,
  };
}

/**
 * Bifele de pe rândurile de produse (`data-label-id`, randate server-side)
 * scriu în lista comună de stickere; bara de jos (StickerTray, din layout-ul
 * CRM) e cea care printează.
 */
export function LabelPicker({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const selected = useStickers();

  // La schimbarea listei sau paginii, rebifează rândurile vizibile și
  // completează codul/denumirea pentru piesele adăugate din alte pagini.
  useEffect(() => {
    const boxes = ref.current?.querySelectorAll<HTMLInputElement>("input[data-label-id]");
    if (!boxes) return;
    const ids = new Set(selected.map((item) => item.id));
    const visible = Array.from(boxes, (box) => {
      box.checked = ids.has(box.dataset.labelId!);
      return itemFromBox(box);
    });
    updateStickers((current) => hydrateLabelSelection(current, visible));
  }, [children, selected]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    function onChange(event: Event) {
      const box = event.target as HTMLInputElement;
      if (!box.dataset?.labelId) return;
      updateStickers((current) => toggleLabelSelection(current, itemFromBox(box), box.checked));
    }
    node.addEventListener("change", onChange);
    return () => node.removeEventListener("change", onChange);
  }, []);

  return <div ref={ref}>{children}</div>;
}
