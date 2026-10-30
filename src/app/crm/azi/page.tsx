import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import { getBrowseOptions, type BrowseOption } from "@/lib/catalog/browse";
import { buildCompatibilityLines } from "@/lib/catalog/compatibility-display";
import { getCatalogData } from "@/lib/catalog/queries";
import { canCreateSales, canWriteCatalog } from "@/lib/roles";
import { requireCrmSection } from "../_components/guard";
import { formatMoney } from "../_components/format";
import { ProductFinder } from "./product-finder";
import { ProductPreview, type ProductPreviewValue } from "./product-preview";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CatalogData = Awaited<ReturnType<typeof getCatalogData>>;

type Params = {
  q?: string;
  marca?: string;
  model?: string;
  pagina?: string;
};

/** Câte butoane de marcă/model se văd înainte de „+N". */
const VISIBLE_CHIPS = 12;

/**
 * Pagina de start e ghișeul de produse: la birou, cu clientul în față, omul
 * caută piesa după cod sau mașină ori o alege pe marcă → model, și vede
 * imediat prețul și câte sunt pe stoc. Atât — restul e în meniu.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<Params> }) {
  const appUser = await requireCrmSection("azi");
  const params = await searchParams;
  const hasFilters = Boolean(params.q?.trim() || params.marca || params.model);

  const [browse, catalog] = await Promise.all([
    getBrowseOptions(params.marca),
    hasFilters
      ? getCatalogData(
          {
            q: params.q,
            brand: params.marca,
            model: params.model,
            page: params.pagina,
          },
        )
      : Promise.resolve(null),
  ]);

  const href = (changes: Partial<Params>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, pagina: undefined, ...changes })) {
      if (value) next.set(key, value);
    }
    const search = next.toString();
    return search ? `/crm/azi?${search}` : "/crm/azi";
  };

  return (
    <section className="motion-page mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 p-4 lg:p-8">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <ProductFinder />
        </div>
        {canCreateSales(appUser.role) ? (
          <Link
            className="button-primary inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#18181b] px-4 text-sm font-semibold text-white hover:bg-[#27272a]"
            href="/crm/vanzari?nou=1"
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Vânzare nouă</span>
          </Link>
        ) : null}
      </div>

      <ChipRow
        options={browse.brands}
        selected={params.marca}
        hrefFor={(id) => href({ marca: id === params.marca ? undefined : id, model: undefined })}
      />
      {params.marca ? (
        <ChipRow
          options={browse.models}
          selected={params.model}
          hrefFor={(id) => href({ model: id === params.model ? undefined : id })}
        />
      ) : null}

      {catalog ? (
        <Results
          catalog={catalog}
          canModify={canWriteCatalog(appUser.role)}
          canSell={canCreateSales(appUser.role)}
          href={href}
        />
      ) : null}
    </section>
  );
}

function ChipRow({
  options,
  selected,
  hrefFor,
}: {
  options: BrowseOption[];
  selected?: string;
  hrefFor: (id: string) => string;
}) {
  if (options.length === 0) return null;
  // Cea aleasă rămâne la vedere chiar dacă ar cădea în „Toate".
  const visible = options.slice(0, VISIBLE_CHIPS);
  const chosen = options.find((option) => option.id === selected);
  if (chosen && !visible.includes(chosen)) visible.push(chosen);
  const hidden = options.filter((option) => !visible.includes(option));

  const chip = (option: BrowseOption) => {
    const active = option.id === selected;
    return (
      <Link
        key={option.id}
        aria-current={active ? "true" : undefined}
        href={hrefFor(option.id)}
        className={`inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium ${
          active
            ? "border-[#18181b] bg-[#18181b] text-white"
            : "border-[#e4e4e7] bg-white text-[#3f3f46] hover:border-[#d4d4d8] hover:bg-[#fafafa]"
        }`}
      >
        {option.name}
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map(chip)}
      {hidden.length > 0 ? (
        <details className="group open:basis-full">
          <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-lg px-3 text-sm font-medium text-[#52525b] hover:bg-[#f4f4f5] group-open:hidden [&::-webkit-details-marker]:hidden">
            +{hidden.length}
          </summary>
          <div className="flex flex-wrap gap-1.5">{hidden.map(chip)}</div>
        </details>
      ) : null}
    </div>
  );
}

function Results({
  catalog,
  canModify,
  canSell,
  href,
}: {
  catalog: CatalogData;
  canModify: boolean;
  canSell: boolean;
  href: (changes: Partial<Params>) => string;
}) {
  const { page, pageCount } = catalog.pagination;

  if (catalog.products.length === 0) {
    return <p className="px-1 py-6 text-sm text-[#52525b]">Nu am găsit nimic.</p>;
  }

  return (
    <div className="grid gap-2">
      <ul className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
        {catalog.products.map((product) => {
          const preview = toPreview(product, catalog);
          return (
            <li key={product.id} className="border-t border-[#f0f0f2] first:border-t-0">
              <ProductPreview product={preview} canModify={canModify} canSell={canSell}>
                <ResultRow product={preview} />
              </ProductPreview>
            </li>
          );
        })}
      </ul>

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-2 text-sm text-[#52525b]">
          <PageArrow href={page > 1 ? href({ pagina: String(page - 1) }) : null} label="Pagina anterioară">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </PageArrow>
          <span className="tabular-nums">
            {page} / {pageCount}
          </span>
          <PageArrow href={page < pageCount ? href({ pagina: String(page + 1) }) : null} label="Pagina următoare">
            <ChevronRight className="size-4" aria-hidden="true" />
          </PageArrow>
        </div>
      ) : null}
    </div>
  );
}

function PageArrow({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  const className = "grid size-9 place-items-center rounded-lg border border-[#e4e4e7] bg-white";
  if (!href) return <span className={`${className} text-[#d4d4d8]`}>{children}</span>;
  return (
    <Link aria-label={label} className={`${className} text-[#18181b] hover:bg-[#f4f4f5]`} href={href}>
      {children}
    </Link>
  );
}

function ResultRow({ product }: { product: ProductPreviewValue }) {
  const first = product.compatibilities[0];
  const more = product.compatibilities.length - 1;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-[#fafafa]">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[#18181b]">{product.description}</p>
        <p className="truncate text-sm text-[#71717a]">
          {product.code ? <span className="font-mono text-[#3f3f46]">{product.code}</span> : null}
          {product.code && first ? " · " : null}
          {first ? `${first.title} ${first.years}` : null}
          {more > 0 ? ` +${more}` : null}
        </p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="font-semibold text-[#18181b]">
          {product.price ?? <span className="font-normal text-[#a1a1aa]">—</span>}
        </p>
        <p className={`text-sm ${product.total > 0 ? "text-[#166534]" : "text-[#b91c1c]"}`}>
          {product.total > 0 ? `${product.total} buc.` : "lipsă"}
        </p>
      </div>
    </div>
  );
}

function toPreview(product: CatalogData["products"][number], catalog: CatalogData): ProductPreviewValue {
  const stocks = catalog.warehouses.map((warehouse) => ({
    id: warehouse.id,
    name: warehouse.name.replace("Pavilion ", ""),
    quantity: product.warehouseStocks.find((stock) => stock.warehouseId === warehouse.id)?.quantity ?? 0,
  }));
  return {
    id: product.id,
    code: product.externalCode,
    alternativeCode: product.alternativeCode,
    description: product.description,
    type: product.type.name,
    // Produsele vechi pot avea doar mașina principală, fără legături suplimentare.
    compatibilities: buildCompatibilityLines(
      (product.productFitments.length > 0
        ? product.productFitments.map(({ fitment }) => fitment)
        : [product.fitment]
      ).map((fitment) => ({
        id: fitment.id,
        brandName: fitment.carModel.brand.name,
        modelName: fitment.carModel.name,
        yearStart: fitment.yearStart,
        yearEnd: fitment.yearEnd,
        yearOpenEnded: fitment.yearOpenEnded,
      })),
    ),
    stocks,
    total: stocks.reduce((sum, stock) => sum + stock.quantity, 0),
    price: product.salePriceLei != null ? `${formatMoney(product.salePriceLei)} lei` : null,
    notes: product.notes,
  };
}
