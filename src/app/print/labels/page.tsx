import Image from "next/image";
import { redirect } from "next/navigation";
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import {
  LABEL_BRAND,
  LABEL_COMPATIBILITY_PREFIX,
  LABEL_PHONE,
  buildPartLabel,
  buildProductCodeLabel,
} from "@/lib/labels/format";
import { LABEL_SIZES, type LabelSizeKey } from "@/lib/labels/layout";
import {
  buildLabelSlots,
  labelCompatibility,
  loadLabelProducts,
  parseLabelRequest,
  type LabelProduct,
} from "@/lib/labels/request";
import { LabelControls } from "@/app/print/labels/label-controls";

export const dynamic = "force-dynamic";

type LabelsProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

/** Etichete produse — grilă exactă pe foaia autoadezivă A4 sau rolă (1/pagină). */
export default async function LabelsPage({ searchParams }: LabelsProps) {
  const authState = await getAuthAccessState();
  if (authState.kind === "UNAUTHENTICATED") redirect("/auth/sign-in");
  if (authState.kind !== "AUTHENTICATED") redirect("/auth/2fa/continue");

  const params = await searchParams;
  const request = parseLabelRequest((key) => params[key]);
  const { counts, alternativeCodeIds, size, layout, dim, perSheet, skip } = request;
  const products = await loadLabelProducts([...counts.keys()]);
  const { labels, sheets } = buildLabelSlots(request, products);

  // Click pe o celulă din prima foaie = de acolo începe printul (foaie începută).
  const startHref = (position: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    query.set("skip", String(position));
    return `/print/labels?${query.toString()}`;
  };

  return (
    <main className="labels-page min-h-screen bg-[#f6f6f4] p-6 print:bg-white print:p-0">
      <style>{`
        @page {
          size: ${layout === "roll" ? `${dim.w}mm ${dim.h}mm` : "A4"};
          margin: 0;
        }
        .label-sheet {
          width: 210mm;
          padding: ${dim.my}mm ${dim.mx}mm 0;
          display: grid;
          grid-template-columns: repeat(${dim.cols}, ${dim.w}mm);
          grid-auto-rows: ${dim.h}mm;
          row-gap: ${dim.gy}mm;
          justify-content: ${dim.mx > 0 ? "center" : "start"};
          box-sizing: border-box;
          background: white;
        }
        .label-roll { display: grid; grid-template-columns: ${dim.w}mm; justify-content: center; gap: 2mm; }
        .label-sticker {
          width: ${dim.w}mm;
          height: ${dim.h}mm;
          overflow: hidden;
          box-sizing: border-box;
          padding-inline: ${dim.padX}mm;
          /* fără hinting per-OS: aceleași lățimi de glif pe orice browser */
          text-rendering: geometricPrecision;
          font-kerning: none;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .label-pick { display: block; color: inherit; text-decoration: none; }
        .label-head > * { min-width: 0; }
        .label-logo { flex: none; }
        .label-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .label-detail { margin-left: ${dim.detailOffsetX}mm; }
        .label-model { white-space: normal; overflow: hidden; line-height: 1.05; max-height: 4.2em; }
        .label-part {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media screen {
          .label-sheet { margin: 0 auto 10mm; box-shadow: 0 1px 4px rgba(0,0,0,.12); min-height: 297mm; }
          .label-cell { outline: 1px dashed #d8d6d0; outline-offset: -1px; }
          .label-pick:hover { outline: 2px solid #1b1a17; outline-offset: -2px; }
          .label-used { background: repeating-linear-gradient(135deg, #f1f0ec 0 5px, #fff 5px 10px); }
          .label-cell[draggable="true"] { cursor: grab; }
          .label-dragging { opacity: .35; }
          .label-drop { outline: 2px solid #2563eb !important; outline-offset: -2px; }
        }
        @media print {
          .labels-toolbar, .labels-empty { display: none !important; }
          .label-sheet { break-after: page; }
          .label-sheet:last-child { break-after: auto; }
          .label-roll { gap: 0; }
          .label-roll .label-sticker { break-after: page; }
        }
      `}</style>

      <div className="labels-toolbar mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1b1a17]">Stickere produse</h1>
          <p className="text-sm text-[#6f6b63]">
            {products.length} produse, {labels.length} stickere,{" "}
            {layout === "roll"
              ? `rolă ${dim.w}×${dim.h} mm`
              : `${sheets.length} ${sheets.length === 1 ? "foaie" : "foi"} A4, ${dim.w}×${dim.h} mm, ${perSheet}/foaie`}
          </p>
          <p className="mt-1 text-xs text-[#8a857c]">
            Print: Scală 100%, Margini: Fără. Trage stickerele ca să schimbi ordinea; click pe celulă = de acolo începe.
          </p>
        </div>
        <LabelControls
          size={size}
          layout={layout}
          skip={skip}
          perSheet={perSheet}
          items={products.map((p) => ({
            id: p.id,
            code: p.externalCode ?? "",
            alternativeCode: p.alternativeCode ?? "",
            name: p.description,
            compatibility: labelCompatibility(p),
            count: counts.get(p.id) ?? 1,
            includeAlternativeCode: alternativeCodeIds.has(p.id),
          }))}
        />
      </div>

      {labels.length === 0 ? (
        <p className="labels-empty text-sm text-[#6f6b63]">Niciun produs selectat.</p>
      ) : null}

      {layout === "roll" ? (
        <div className="label-roll">
          {labels.map((slot) => (
            <LabelSticker
              key={`${slot.product.id}-${slot.copy}`}
              product={slot.product}
              compatibility={slot.compatibility}
              includeAlternativeCode={slot.includeAlternativeCode}
              dim={dim}
            />
          ))}
        </div>
      ) : (
        sheets.map((sheet, sheetIndex) => {
          // Prima foaie are mereu toate celulele: oricare poate fi aleasă ca start.
          const cells =
            sheetIndex === 0
              ? [...sheet, ...Array.from({ length: perSheet - sheet.length }, () => null)]
              : sheet;
          return (
            <div key={sheetIndex} className="label-sheet">
              {cells.map((slot, i) => {
                const sticker = slot ? (
                  <LabelSticker
                    product={slot.product}
                    compatibility={slot.compatibility}
                    includeAlternativeCode={slot.includeAlternativeCode}
                    dim={dim}
                  />
                ) : null;
                const key = slot ? `${slot.product.id}-${slot.copy}` : `empty-${i}`;
                // Ținte pentru drag & drop (LabelControls ascultă pe document).
                const dnd = {
                  "data-cell": sheetIndex * perSheet + i,
                  "data-sticker-id": slot?.product.id,
                  draggable: Boolean(slot),
                };
                if (sheetIndex > 0) {
                  return (
                    <div key={key} className="label-cell" {...dnd}>
                      {sticker}
                    </div>
                  );
                }
                return (
                  <a
                    key={key}
                    {...dnd}
                    href={startHref(i)}
                    title={`Începe printul de la poziția ${i + 1}`}
                    className={`label-cell label-pick${i < skip ? " label-used" : ""}`}
                  >
                    {sticker}
                  </a>
                );
              })}
            </div>
          );
        })
      )}
    </main>
  );
}

function LabelSticker({
  product,
  compatibility,
  includeAlternativeCode,
  dim,
}: {
  product: LabelProduct;
  compatibility: string;
  includeAlternativeCode: boolean;
  dim: (typeof LABEL_SIZES)[LabelSizeKey];
}) {
  const code = buildProductCodeLabel(
    product.externalCode,
    includeAlternativeCode ? product.alternativeCode : null,
  );
  const part = buildPartLabel(product.type.name, product.description);
  const compatibilitySize = Math.max(
    dim.model * (compatibility.length > 55 ? 0.72 : compatibility.length > 35 ? 0.84 : 1),
    5,
  );

  return (
    <div
      className="label-sticker flex flex-col bg-white text-[#111]"
      style={{ paddingTop: `${dim.h * 0.05}mm`, paddingBottom: `${dim.h * 0.09}mm` }}
    >
      <div className="label-head flex items-center justify-center gap-[1.5mm]">
        <span className="flex flex-none items-center gap-[1mm]">
          <Image
            src="/logo.png"
            alt=""
            width={612}
            height={408}
            unoptimized
            draggable={false}
            className="label-logo w-auto"
            style={{ height: `${dim.phone * 1.4}px` }}
          />
          <span
            className="font-bold leading-none tracking-[0.02em]"
            style={{ fontSize: `${dim.phone * 0.8}px` }}
          >
            {LABEL_BRAND}
          </span>
        </span>
      </div>
      <p
        className="label-line text-center font-mono font-bold leading-none tracking-[0.04em]"
        style={{ fontSize: `${dim.code}px`, marginTop: `${dim.h * 0.04}mm` }}
      >
        {code}
      </p>
      <p
        className="label-line text-center font-sans leading-none"
        style={{
          fontSize: `${Math.max(dim.model * 0.45, 5)}px`,
          marginTop: `${dim.h * 0.075}mm`,
        }}
      >
        {LABEL_COMPATIBILITY_PREFIX}
      </p>
      <p
        className="label-model label-detail mt-[1mm] font-mono font-bold tracking-[0.02em]"
        style={{ fontSize: `${compatibilitySize}px` }}
      >
        {compatibility}
      </p>
      <p
        className="label-part label-detail mt-[1.8mm] font-bold leading-tight"
        style={{ fontSize: `${dim.desc}px` }}
      >
        {part}
      </p>
      <p
        className="label-line mt-auto text-center font-mono font-bold leading-none tracking-[0.03em]"
        style={{ fontSize: `${dim.phone}px` }}
      >
        {LABEL_PHONE}
      </p>
    </div>
  );
}
