"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SIZES = [
  { value: "s", label: "Mic (52×30 mm)" },
  { value: "m", label: "Mediu (70×42 mm)" },
  { value: "l", label: "Mare (70×51 mm)" },
] as const;

const LAYOUTS = [
  { value: "grid", label: "Grilă pe A4" },
  { value: "roll", label: "Rolă (1/pagină)" },
] as const;

export function LabelControls({
  size,
  layout,
  copies,
}: {
  size: string;
  layout: string;
  copies: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.replace(`/print/labels?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-[#6f6b63]">
        Format
        <select
          value={layout}
          onChange={(event) => update("layout", event.target.value)}
          className="rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm text-[#1b1a17]"
        >
          {LAYOUTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-[#6f6b63]">
        Mărime sticker
        <select
          value={size}
          onChange={(event) => update("size", event.target.value)}
          disabled={layout === "roll"}
          className="rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm text-[#1b1a17] disabled:opacity-50"
        >
          {SIZES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-[#6f6b63]">
        Copii / produs
        <input
          type="number"
          min={1}
          max={50}
          defaultValue={copies}
          onChange={(event) => {
            const value = Math.min(Math.max(Number(event.target.value) || 1, 1), 50);
            update("copies", String(value));
          }}
          className="w-24 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm text-[#1b1a17]"
        />
      </label>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
      >
        Printează
      </button>
    </div>
  );
}
