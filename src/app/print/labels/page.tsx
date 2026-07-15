import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentAppUser } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import {
  LABEL_COMPATIBILITY_PREFIX,
  LABEL_PHONE,
  buildCompatibilityLabel,
  buildPartLabel,
  upperLabelText,
} from "@/lib/labels/format";
import { LABEL_SIZES, type LabelSizeKey } from "@/lib/labels/layout";
import { LabelControls } from "@/app/print/labels/label-controls";

export const dynamic = "force-dynamic";

type LabelsProps = {
  searchParams: Promise<{
    ids?: string;
    copies?: string;
    items?: string;
    size?: string;
    layout?: string;
    skip?: string;
  }>;
};

const clampCount = (n: number) => Math.min(Math.max(Math.round(n) || 1, 1), 50);

/** `items=id:3,id:2` → Map id→copii. Fallback: `ids=...&copies=N` (linkuri vechi). */
function parseItems(items?: string, ids?: string, copies?: string) {
  const map = new Map<string, number>();
  if (items) {
    for (const part of items.split(",")) {
      const [id, n] = part.split(":");
      if (id.trim()) map.set(id.trim(), clampCount(Number(n)));
    }
    return map;
  }
  const perProduct = clampCount(Number(copies));
  for (const id of (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    map.set(id, perProduct);
  }
  return map;
}

/** Etichete produse — grilă exactă pe foaia autoadezivă A4 sau rolă (1/pagină). */
export default async function LabelsPage({ searchParams }: LabelsProps) {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/sign-in");

  const params = await searchParams;
  const counts = parseItems(params.items, params.ids, params.copies);
  const size: LabelSizeKey = params.size === "s" || params.size === "m" ? params.size : "l";
  const layout = params.layout === "roll" ? "roll" : "grid";
  const dim = LABEL_SIZES[size];
  const perSheet = dim.cols * dim.rows;
  const skip =
    layout === "grid" ? Math.min(Math.max(Number(params.skip) || 0, 0), perSheet - 1) : 0;

  const fetched = counts.size
    ? await prisma.product.findMany({
        where: { id: { in: [...counts.keys()] } },
        include: productLabelInclude,
      })
    : [];
  // păstrează ordinea din URL, nu ordinea din DB
  const products = [...counts.keys()]
    .map((id) => fetched.find((p) => p.id === id))
    .filter((p): p is (typeof fetched)[number] => Boolean(p));

  const labels = products.flatMap((product) =>
    Array.from({ length: counts.get(product.id) ?? 1 }, (_, copy) => ({ product, copy })),
  );

  // celule goale la început = poziții deja folosite pe o foaie începută
  const slots: (typeof labels[number] | null)[] = [
    ...Array.from({ length: skip }, () => null),
    ...labels,
  ];
  const sheets: (typeof slots)[] = [];
  for (let i = 0; i < slots.length; i += perSheet) {
    sheets.push(slots.slice(i, i + perSheet));
  }

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
        }
        .label-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .label-part {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @media screen {
          .label-sheet { margin: 0 auto 10mm; box-shadow: 0 1px 4px rgba(0,0,0,.12); min-height: 297mm; }
          .label-cell { outline: 1px dashed #d8d6d0; outline-offset: -1px; }
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
            {products.length} produse · {labels.length} stickere ·{" "}
            {layout === "roll"
              ? `rolă ${dim.w}×${dim.h} mm`
              : `${sheets.length} ${sheets.length === 1 ? "foaie" : "foi"} A4 · ${dim.w}×${dim.h} mm · ${perSheet}/foaie`}
          </p>
        </div>
        <LabelControls
          size={size}
          layout={layout}
          skip={skip}
          items={products.map((p) => ({
            id: p.id,
            code: p.externalCode ?? "—",
            name: p.description,
            count: counts.get(p.id) ?? 1,
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
              dim={dim}
            />
          ))}
        </div>
      ) : (
        sheets.map((sheet, sheetIndex) => (
          <div key={sheetIndex} className="label-sheet">
            {sheet.map((slot, i) =>
              slot ? (
                <div key={`${slot.product.id}-${slot.copy}`} className="label-cell">
                  <LabelSticker product={slot.product} dim={dim} />
                </div>
              ) : (
                <div key={`empty-${i}`} className="label-cell" />
              ),
            )}
          </div>
        ))
      )}
    </main>
  );
}

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    type: true;
    fitment: {
      include: {
        carModel: {
          include: {
            brand: true;
          };
        };
      };
    };
  };
}>;

const productLabelInclude = {
  type: true,
  fitment: {
    include: {
      carModel: {
        include: {
          brand: true,
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

function LabelSticker({
  product,
  dim,
}: {
  product: ProductWithRelations;
  dim: (typeof LABEL_SIZES)[LabelSizeKey];
}) {
  const model = product.fitment.carModel;
  const code = upperLabelText(product.externalCode ?? "-");
  const compatibility = buildCompatibilityLabel({
    brandName: model.brand.name,
    modelName: model.name,
    yearStart: product.fitment.yearStart,
    yearEnd: product.fitment.yearEnd,
    yearOpenEnded: product.fitment.yearOpenEnded,
  });
  const part = buildPartLabel(product.type.name, product.description);

  return (
    <div className="label-sticker flex flex-col bg-white pb-[6mm] pt-[3.5mm] text-[#111]">
      <p
        className="label-line text-center font-mono font-bold leading-none tracking-[0.04em]"
        style={{ fontSize: `${dim.code}px` }}
      >
        {code}
      </p>
      <p
        className="label-line mt-[4mm] text-center font-sans leading-none"
        style={{ fontSize: `${Math.max(dim.model * 0.45, 5)}px` }}
      >
        {LABEL_COMPATIBILITY_PREFIX}
      </p>
      <p
        className="label-line mt-[1mm] font-mono font-bold leading-none tracking-[0.02em]"
        style={{ fontSize: `${dim.model}px` }}
      >
        {compatibility}
      </p>
      <p
        className="label-part mt-[1.8mm] font-bold leading-tight"
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
