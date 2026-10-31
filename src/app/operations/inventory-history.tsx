"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import type { InventoryHistoryEntry } from "@/lib/operations/inventory-progress";

/** Câte zile în urmă o numărătoare e „recentă": se arată ca avertisment (numărat deja). */
const RECENT_DAYS = 30;

type HistoryCache = Record<string, InventoryHistoryEntry[]>;

/**
 * Mini-istoricul pieselor de pe rânduri: ultimele inventare din depozitul ales.
 * Se cer toate deodată (un inventar poate avea 100 de rânduri), doar cele încă
 * necerute, cu o mică pauză cât se adaugă rânduri.
 */
export function useInventoryHistory(productIds: string[], warehouseId: string) {
  const [cache, setCache] = useState<HistoryCache>({});
  const missing = productIds.filter((id) => id && !(`${warehouseId}:${id}` in cache));
  const missingKey = [...new Set(missing)].sort().join(",");

  useEffect(() => {
    if (!missingKey || !warehouseId) return;
    let alive = true;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ warehouseId, productIds: missingKey });
        const response = await fetch(`/api/inventory/history?${params}`);
        if (!response.ok) return;
        const data = (await response.json()) as { history: Record<string, InventoryHistoryEntry[]> };
        if (!alive) return;
        setCache((current) => {
          const next = { ...current };
          for (const id of missingKey.split(",")) next[`${warehouseId}:${id}`] = data.history[id] ?? [];
          return next;
        });
      } catch {
        // Fără rețea: istoricul pur și simplu nu apare, numărătoarea merge oricum.
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [missingKey, warehouseId]);

  return {
    historyOf: (productId: string) => cache[`${warehouseId}:${productId}`] ?? [],
    /** După salvare: istoricul s-a schimbat, se cere din nou data viitoare. */
    clear: () => setCache({}),
  };
}

/** „20.08: era 0 → 1" — câte o linie mică pe inventar trecut; cele recente („deja"), portocaliu. */
export function InventoryHistoryLines({ entries }: { entries: InventoryHistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <span className="grid gap-0.5 text-xs">
      {entries.map((entry) => (
        <span
          key={entry.number}
          className={`flex items-center gap-1 ${isRecent(entry.date) ? "font-medium text-[#b45309]" : "text-[#71717a]"}`}
          title={`Inventar #${entry.number}${isRecent(entry.date) ? " — numărat deja de curând" : ""}`}
        >
          <History className="size-3 shrink-0" aria-hidden="true" />
          {isRecent(entry.date) ? "deja " : ""}
          {formatDay(entry.date)}: {describe(entry)}
        </span>
      ))}
    </span>
  );
}

function describe(entry: InventoryHistoryEntry) {
  if (entry.before !== null && entry.counted !== null) return `era ${entry.before} → ${entry.counted}`;
  if (entry.counted !== null) return `numărat ${entry.counted}`;
  if (entry.difference !== null) return entry.difference > 0 ? `+${entry.difference}` : `−${-entry.difference}`;
  return "numărat";
}

function isRecent(date: string) {
  const day = new Date(`${date}T12:00:00`).getTime();
  return Date.now() - day <= RECENT_DAYS * 24 * 60 * 60 * 1000;
}

/** „31.10" anul ăsta, „20.08.25" pentru anii trecuți. */
function formatDay(value: string) {
  const [year, month, day] = value.split("-");
  return year === String(new Date().getFullYear()) ? `${day}.${month}` : `${day}.${month}.${year.slice(2)}`;
}
