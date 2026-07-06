import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import { LabelControls } from "@/app/print/labels/label-controls";

export const dynamic = "force-dynamic";

type LabelsProps = {
  searchParams: Promise<{
    ids?: string;
    copies?: string;
    size?: string;
    layout?: string;
  }>;
};

const SIZES = {
  s: { w: 52, h: 30, code: 12, desc: 8, meta: 7, price: 12 },
  m: { w: 70, h: 42.4, code: 14, desc: 10, meta: 8.5, price: 16 },
  l: { w: 70, h: 50.8, code: 15, desc: 11, meta: 10, price: 18 },
} as const;

type SizeKey = keyof typeof SIZES;

/** Etichete produse — grilă pe A4 (mai multe/pagină) sau rolă (1/pagină). */
export default async function LabelsPage({ searchParams }: LabelsProps) {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/sign-in");

  const params = await searchParams;
  const ids = (params.ids ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const copies = Math.min(Math.max(Number(params.copies) || 1, 1), 50);
  const size: SizeKey = params.size === "s" || params.size === "m" ? params.size : "l";
  const layout = params.layout === "roll" ? "roll" : "grid";
  const dim = SIZES[size];

  const products = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        include: {
          type: true,
          fitment: { include: { carModel: { include: { brand: true } } } },
        },
      })
    : [];

  const labels = products.flatMap((product) =>
    Array.from({ length: copies }, (_, copy) => ({ product, copy })),
  );

  return (
    <main className="labels-page min-h-screen bg-[#f6f6f4] p-6 print:bg-white print:p-0">
      <style>{`
        @page {
          size: ${layout === "roll" ? `${dim.w}mm ${dim.h}mm` : "A4"};
          margin: ${layout === "roll" ? "0" : "8mm"};
        }
        .label-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, ${dim.w}mm);
          gap: 2mm;
          justify-content: center;
        }
        .label-sticker { width: ${dim.w}mm; height: ${dim.h}mm; break-inside: avoid; }
        @media print {
          .labels-toolbar { display: none !important; }
          .label-grid { gap: ${layout === "roll" ? "0" : "1.5mm"}; }
          .label-sticker {
            border: none !important;
            box-shadow: none !important;
            ${layout === "roll" ? "page-break-after: always; break-after: page;" : ""}
          }
        }
      `}</style>

      <div className="labels-toolbar mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1b1a17]">Stickere produse</h1>
          <p className="text-sm text-[#6f6b63]">
            {products.length} produse · {labels.length} stickere ·{" "}
            {layout === "roll"
              ? `rolă ${dim.w}×${dim.h} mm`
              : `grilă A4 · ${dim.w}×${dim.h} mm`}
          </p>
        </div>
        <LabelControls size={size} layout={layout} copies={copies} />
      </div>

      {labels.length === 0 ? (
        <p className="text-sm text-[#6f6b63]">Niciun produs selectat.</p>
      ) : null}

      <div className="label-grid">
        {labels.map(({ product, copy }) => {
          const model = product.fitment.carModel;
          const years = formatYears(
            product.fitment.yearStart,
            product.fitment.yearEnd,
            product.fitment.yearOpenEnded,
          );
          return (
            <div
              key={`${product.id}-${copy}`}
              className="label-sticker flex flex-col overflow-hidden border border-[#e8e7e3] bg-white p-[2.5mm] text-[#111]"
            >
              <div className="flex items-baseline justify-between border-b border-[#111] pb-[1mm]">
                <span
                  className="font-bold uppercase tracking-widest"
                  style={{ fontSize: `${dim.meta}px` }}
                >
                  Nadin Auto
                </span>
                <span className="font-mono" style={{ fontSize: `${dim.meta}px` }}>
                  {product.type.name}
                </span>
              </div>
              <p
                className="mt-[1mm] font-mono font-bold leading-none"
                style={{ fontSize: `${dim.code}px` }}
              >
                {product.externalCode ?? "—"}
              </p>
              <p
                className="mt-[1mm] line-clamp-2 font-semibold leading-tight"
                style={{ fontSize: `${dim.desc}px` }}
              >
                {product.description}
              </p>
              <p
                className="mt-[0.5mm] leading-tight text-[#333]"
                style={{ fontSize: `${dim.meta}px` }}
              >
                {model.brand.name} {model.name}
                {years ? ` · ${years}` : ""}
              </p>
              <p
                className="mt-auto text-right font-bold leading-none"
                style={{ fontSize: `${dim.price}px` }}
              >
                {product.salePriceLei != null
                  ? `${new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(Number(product.salePriceLei))} lei`
                  : ""}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function formatYears(start: number | null, end: number | null, openEnded: boolean) {
  if (!start && !end) return "";
  if (openEnded) return `${start}+`;
  return [start, end].filter(Boolean).join("-");
}
