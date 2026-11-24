"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_LABEL_FORMAT,
  parseLabelSelection,
  serializeLabelSelection,
  type LabelPrintFormat,
  type LabelSelectionItem,
} from "@/app/catalog/label-selection";

/**
 * Lista de stickere, una singură pentru tot CRM-ul: produsele, recepțiile,
 * inventarul și fișa produsului adaugă aici, iar bara de jos printează tot
 * deodată (o foaie A4 pentru trei recepții, nu trei foi începute).
 *
 * localStorage, nu sessionStorage: pagina de print se deschide în alt tab și
 * trebuie să vadă și să modifice aceeași listă (evenimentul `storage`).
 */
const LIST_KEY = "nadin-stickers";
const FORMAT_KEY = "nadin-stickers-format";
const EMPTY: LabelSelectionItem[] = [];

let cache: { raw: string | null; items: LabelSelectionItem[] } = { raw: null, items: EMPTY };
const listeners = new Set<() => void>();

function read() {
  const raw = localStorage.getItem(LIST_KEY);
  if (raw !== cache.raw) cache = { raw, items: raw ? parseLabelSelection(raw) : EMPTY };
  return cache.items;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LIST_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStickers() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function updateStickers(change: (items: LabelSelectionItem[]) => LabelSelectionItem[]) {
  const current = read();
  const next = change(current);
  if (next === current) return;
  if (next.length === 0) localStorage.removeItem(LIST_KEY);
  else localStorage.setItem(LIST_KEY, serializeLabelSelection(next));
  listeners.forEach((listener) => listener());
}

export function clearStickers() {
  updateStickers(() => EMPTY);
}

/** Ultima mărime/format ales la print — bara de jos deschide direct cu ele. */
export function readStickerFormat(): LabelPrintFormat {
  try {
    const stored = JSON.parse(localStorage.getItem(FORMAT_KEY) ?? "null") as Partial<LabelPrintFormat> | null;
    return {
      size: stored?.size === "s" || stored?.size === "m" ? stored.size : DEFAULT_LABEL_FORMAT.size,
      layout: stored?.layout === "roll" ? "roll" : DEFAULT_LABEL_FORMAT.layout,
    };
  } catch {
    return DEFAULT_LABEL_FORMAT;
  }
}

export function saveStickerFormat(format: LabelPrintFormat) {
  localStorage.setItem(FORMAT_KEY, JSON.stringify(format));
}
