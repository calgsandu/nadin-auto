import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/access";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/app/print/labels/print-button";

export const dynamic = "force-dynamic";

type LabelsProps = {
  searchParams: Promise<{ ids?: string; copies?: string }>;
};

/** Printable product stickers, 70mm wide × 50.8mm tall (one per page). */
export default async function LabelsPage({ searchParams }: LabelsProps) {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/auth/sign-in");

  const params = await searchParams;
  const ids = (params.ids ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const copies = Math.min(Math.max(Number(params.copies) || 1, 1), 50);

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
        @page { size: 70mm 50.8mm; margin: 0; }
        @media print {
          .labels-toolbar { display: none; }
          .label-sticker {
            width: 70mm;
            height: 50.8mm;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always;
            break-after: page;
            margin: 0 !important;
          }
        }
        .label-sticker { width: 70mm; height: 50.8mm; }
      `}</style>

      <div className="labels-toolbar mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#1b1a17]">Stickere produse</h1>
          <p className="text-sm text-[#6f6b63]">
            {labels.length} stickere · 70 × 50.8 mm · fiecare pe pagina lui la printare
          </p>
        </div>
        <PrintButton />
      </div>

      {labels.length === 0 ? (
        <p className="text-sm text-[#6f6b63]">Niciun produs selectat.</p>
      ) : null}

      <div className="flex flex-wrap gap-4 print:block print:gap-0">
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
              className="label-sticker flex flex-col overflow-hidden border border-[#e8e7e3] bg-white p-[3mm] text-[#111]"
            >
              <div className="flex items-baseline justify-between border-b border-[#111] pb-[1mm]">
                <span className="text-[10px] font-bold uppercase tracking-widest">Nadin Auto</span>
                <span className="font-mono text-[9px]">{product.type.name}</span>
              </div>
              <p className="mt-[1.5mm] font-mono text-[15px] font-bold leading-none">
                {product.externalCode ?? "—"}
              </p>
              <p className="mt-[1.5mm] line-clamp-2 text-[11px] font-semibold leading-tight">
                {product.description}
              </p>
              <p className="mt-[1mm] text-[10px] leading-tight text-[#333]">
                {model.brand.name} {model.name}
                {years ? ` · ${years}` : ""}
              </p>
              <p className="mt-auto text-right text-[18px] font-bold leading-none">
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
