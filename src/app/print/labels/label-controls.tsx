"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SIZES = [
  { value: "s", label: "Mic (52×30 mm)" },
  { value: "m", label: "Mediu (70×42 mm · 21/foaie)" },
  { value: "l", label: "Mare (70×51 mm · 15/foaie)" },
] as const;

const LAYOUTS = [
  { value: "grid", label: "Foaie A4" },
  { value: "roll", label: "Rolă (1/pagină)" },
] as const;

export type LabelItem = {
  id: string;
  code: string;
  name: string;
  count: number;
};

export function LabelControls({
  size,
  layout,
  skip,
  items,
}: {
  size: string;
  layout: string;
  skip: number;
  items: LabelItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString());
    // migrează linkurile vechi ids+copies la items, o singură sursă de adevăr
    next.delete("ids");
    next.delete("copies");
    next.set("items", items.map((it) => `${it.id}:${it.count}`).join(","));
    mutate(next);
    router.replace(`/print/labels?${next.toString()}`);
  }

  function setCount(id: string, count: number) {
    const clamped = Math.min(Math.max(Math.round(count) || 1, 1), 50);
    navigate((next) =>
      next.set(
        "items",
        items
          .map((it) => `${it.id}:${it.id === id ? clamped : it.count}`)
          .join(","),
      ),
    );
  }

  function remove(id: string) {
    navigate((next) =>
      next.set(
        "items",
        items.filter((it) => it.id !== id).map((it) => `${it.id}:${it.count}`).join(","),
      ),
    );
  }

  const pdfHref = () => {
    const p = new URLSearchParams();
    p.set("items", items.map((it) => `${it.id}:${it.count}`).join(","));
    p.set("size", size);
    p.set("layout", layout);
    if (layout === "grid") p.set("skip", String(skip));
    return `/api/export/labels?${p.toString()}`;
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 lg:w-auto">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[#6f6b63]">
          Format
          <select
            value={layout}
            onChange={(event) => navigate((next) => next.set("layout", event.target.value))}
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
            onChange={(event) => navigate((next) => next.set("size", event.target.value))}
            className="rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm text-[#1b1a17]"
          >
            {SIZES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {layout === "grid" ? (
          <label className="flex flex-col gap-1 text-xs text-[#6f6b63]">
            Sari poziții (foaie începută)
            <input
              type="number"
              min={0}
              max={20}
              value={skip}
              onChange={(event) =>
                navigate((next) =>
                  next.set("skip", String(Math.max(Number(event.target.value) || 0, 0))),
                )
              }
              className="w-24 rounded-md border border-[#e8e7e3] bg-white px-3 py-2 text-sm text-[#1b1a17]"
            />
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#33312c]"
        >
          Printează
        </button>
        <a
          href={items.length > 0 ? pdfHref() : undefined}
          download
          aria-disabled={items.length === 0}
          className={`rounded-md border border-[#1b1a17] px-4 py-2.5 text-sm font-semibold text-[#1b1a17] hover:bg-[#f0efec] ${
            items.length === 0 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          Descarcă PDF
        </a>
      </div>

      {items.length > 0 ? (
        <div className="max-h-64 divide-y divide-[#f0efec] overflow-y-auto rounded-md border border-[#e8e7e3] bg-white">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs font-bold text-[#1b1a17]">
                  {item.code}
                </p>
                <p className="truncate text-xs text-[#6f6b63]">{item.name}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCount(item.id, item.count - 1)}
                  disabled={item.count <= 1}
                  className="h-7 w-7 rounded-md border border-[#e8e7e3] text-sm text-[#1b1a17] hover:bg-[#f6f6f4] disabled:opacity-40"
                  aria-label={`Mai puține stickere pentru ${item.code}`}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={item.count}
                  onChange={(event) => setCount(item.id, Number(event.target.value))}
                  className="h-7 w-12 rounded-md border border-[#e8e7e3] text-center text-sm text-[#1b1a17]"
                  aria-label={`Număr stickere pentru ${item.code}`}
                />
                <button
                  type="button"
                  onClick={() => setCount(item.id, item.count + 1)}
                  disabled={item.count >= 50}
                  className="h-7 w-7 rounded-md border border-[#e8e7e3] text-sm text-[#1b1a17] hover:bg-[#f6f6f4] disabled:opacity-40"
                  aria-label={`Mai multe stickere pentru ${item.code}`}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-xs text-[#a09b91] hover:text-[#b3261e]"
                aria-label={`Scoate ${item.code}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
