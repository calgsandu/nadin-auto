import Link from "next/link";
import { ChevronRight, ClipboardCheck, PackagePlus, ShoppingCart } from "lucide-react";
import { getBrowseOptions, type BrowseOption } from "@/lib/catalog/browse";
import { buildCompatibilityLines } from "@/lib/catalog/compatibility-display";
import { getCatalogData } from "@/lib/catalog/queries";
import { getTodayData, type TodayData } from "@/lib/crm/today";
import { canCreateSales, canViewSection, canWriteCatalog } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";
import { requireCrmSection } from "../_components/guard";
import { formatMoney, formatNumber } from "../_components/format";
import { ProductFinder } from "./product-finder";
import { ProductPreview, type ProductPreviewValue } from "./product-preview";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CatalogData = Awaited<ReturnType<typeof getCatalogData>>;

type Params = {
  q?: string;
  marca?: string;
  model?: string;
  tip?: string;
  an?: string;
  stoc?: string;
  pagina?: string;
};

/** Câte butoane de marcă/tip se văd înainte de „Toate". */
const VISIBLE_CHIPS = 14;

/**
 * Pagina de start e ghișeul de produse: la birou, cu clientul în față, omul
 * caută piesa după cod sau mașină ori o răsfoiește pe marcă → model → tip, și
 * vede imediat prețul și unde e pe stoc. Operațiunile stau sus, mici.
 */
export default async function TodayPage({ searchParams }: { searchParams: Promise<Params> }) {
  const appUser = await requireCrmSection("azi");
  const params = await searchParams;
  const hasFilters = Boolean(params.q?.trim() || params.marca || params.model || params.tip || params.an);

  const [browse, catalog, today] = await Promise.all([
    getBrowseOptions(params.marca),
    hasFilters
      ? getCatalogData(
          {
            q: params.q,
            brand: params.marca,
            model: params.model,
            type: params.tip,
            year: params.an,
            page: params.pagina,
          },
          { onlyInStock: params.stoc === "1" },
        )
      : Promise.resolve(null),
    getTodayData(appUser.role),
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
    <section className="motion-page mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-[#18181b]">Caută o piesă</h1>
        <QuickActions role={appUser.role} />
      </div>

      <TodoStrip data={today} role={appUser.role} />

      <ProductFinder />

      <div className="grid gap-3 rounded-xl border border-[#e4e4e7] bg-white p-3">
        <ChipRow
          label="Marca"
          options={browse.brands}
          selected={params.marca}
          hrefFor={(id) => href({ marca: id === params.marca ? undefined : id, model: undefined })}
        />
        {params.marca && browse.models.length > 0 ? (
          <ChipRow
            label="Model"
            options={browse.models}
            selected={params.model}
            hrefFor={(id) => href({ model: id === params.model ? undefined : id })}
          />
        ) : null}
        <ChipRow
          label="Tip piesă"
          options={browse.types}
          selected={params.tip}
          hrefFor={(id) => href({ tip: id === params.tip ? undefined : id })}
        />
      </div>

      {catalog ? (
        <Results
          catalog={catalog}
          canModify={canWriteCatalog(appUser.role)}
          canSell={canCreateSales(appUser.role)}
          href={href}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-[#d4d4d8] px-4 py-10 text-center text-sm text-[#52525b]">
          Scrie în căutare sau alege o marcă, un model ori un tip de piesă ca să vezi produsele.
        </p>
      )}
    </section>
  );
}

function QuickActions({ role }: { role: AppRole }) {
  const secondary =
    "button-secondary inline-flex h-9 items-center gap-1.5 rounded-md border border-[#e4e4e7] bg-white px-3 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]";
  return (
    <div className="ml-auto flex flex-wrap gap-2">
      {canWriteCatalog(role) ? (
        <>
          <Link className={secondary} href="/crm/inventar?nou=1">
            <ClipboardCheck className="size-4 text-[#71717a]" aria-hidden="true" /> Număr stocul
          </Link>
          <Link className={secondary} href="/crm/receptii?nou=1">
            <PackagePlus className="size-4 text-[#71717a]" aria-hidden="true" /> Primesc marfă
          </Link>
        </>
      ) : null}
      {canCreateSales(role) ? (
        <Link
          className="button-primary inline-flex h-9 items-center gap-1.5 rounded-md bg-[#2563eb] px-3.5 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
          href="/crm/vanzari?nou=1"
        >
          <ShoppingCart className="size-4" aria-hidden="true" /> Vânzare nouă
        </Link>
      ) : null}
    </div>
  );
}

/** „De făcut", strâns într-un rând: apare doar ce are ceva în așteptare. */
function TodoStrip({ data, role }: { data: TodayData; role: AppRole }) {
  const items = [
    { show: canViewSection(role, "vanzari"), href: "/crm/vanzari?filtru=nebatute", label: "nebătute la casă azi", count: data.notRegistered },
    { show: canViewSection(role, "de-adus"), href: "/crm/de-adus", label: "de adus în 110A", count: data.restockPending },
    { show: canViewSection(role, "conturi-plata"), href: "/crm/conturi-plata", label: "proforme neachitate", count: data.unpaidAccounts },
    { show: canViewSection(role, "la-comanda"), href: "/crm/la-comanda", label: "comenzi la furnizori în lucru", count: data.openOrders },
    { show: canViewSection(role, "aprobari"), href: "/crm/aprobari", label: "de aprobat", count: data.pendingApprovals },
  ].filter((item) => item.show && item.count > 0);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[#52525b]">De făcut:</span>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="inline-flex items-center gap-1 rounded-full border border-[#fde68a] bg-[#fffbeb] px-2.5 py-0.5 text-[#92400e] hover:border-[#fcd34d]"
        >
          <span className="font-semibold tabular-nums">{formatNumber(item.count)}</span> {item.label}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

function ChipRow({
  label,
  options,
  selected,
  hrefFor,
}: {
  label: string;
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
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
          active
            ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]"
            : "border-[#e4e4e7] bg-white text-[#3f3f46] hover:border-[#d4d4d8] hover:bg-[#fafafa]"
        }`}
      >
        {option.name}
        <span className={`text-xs tabular-nums ${active ? "text-[#1d4ed8]" : "text-[#71717a]"}`}>{option.count}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 text-sm font-medium text-[#52525b]">{label}</span>
      {visible.map(chip)}
      {hidden.length > 0 ? (
        <details className="group open:basis-full">
          <summary className="inline-flex h-8 cursor-pointer list-none items-center rounded-full px-3 text-sm font-medium text-[#2563eb] hover:bg-[#eff6ff] group-open:hidden [&::-webkit-details-marker]:hidden">
            Toate ({options.length})
          </summary>
          <div className="flex flex-wrap gap-1.5 sm:pl-[5.375rem]">{hidden.map(chip)}</div>
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
  const { page, pageCount, pageSize } = catalog.pagination;
  const start = catalog.productCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, catalog.productCount);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-[#52525b]">
          <span className="font-semibold text-[#18181b]">{formatNumber(catalog.productCount)}</span>{" "}
          {catalog.productCount === 1 ? "produs" : "produse"}
          {catalog.productCount > pageSize ? ` · ${start}–${end}` : null}
        </p>
        <Link className="font-medium text-[#2563eb] hover:underline" href="/crm/azi">
          Resetează căutarea
        </Link>
      </div>

      {catalog.products.length === 0 ? (
        <p className="rounded-xl border border-[#e4e4e7] bg-white px-4 py-10 text-center text-sm text-[#52525b]">
          Nu am găsit produse. Încearcă doar codul, sau mai puține cuvinte.
        </p>
      ) : (
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
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="mr-auto text-[#52525b]">
            Pagina {page} din {pageCount}
          </span>
          {page > 1 ? (
            <Link className="button-secondary rounded-md border border-[#e4e4e7] bg-white px-3 py-1.5 font-medium hover:bg-[#f4f4f5]" href={href({ pagina: String(page - 1) })}>
              Înapoi
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link className="button-secondary rounded-md border border-[#e4e4e7] bg-white px-3 py-1.5 font-medium hover:bg-[#f4f4f5]" href={href({ pagina: String(page + 1) })}>
              Înainte
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultRow({ product }: { product: ProductPreviewValue }) {
  const shown = product.compatibilities.slice(0, 2);
  const more = product.compatibilities.length - shown.length;
  const inStock = product.stocks.filter((stock) => stock.quantity > 0);

  return (
    <div className="grid gap-x-4 gap-y-2 px-4 py-3 hover:bg-[#fafafa] md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_8rem] md:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2">
          {product.code ? (
            <span className="font-mono text-sm font-semibold text-[#18181b]">{product.code}</span>
          ) : null}
          <span className="text-base font-medium text-[#18181b]">{product.description}</span>
          <span className="text-sm text-[#71717a]">{product.type}</span>
        </p>
        <p className="mt-0.5 truncate text-sm text-[#52525b]">
          {shown.map((compatibility) => `${compatibility.title} · ${compatibility.years}`).join("  ·  ")}
          {more > 0 ? <span className="text-[#71717a]"> +{more} mașini</span> : null}
        </p>
      </div>
      {/* Totalul mare, apoi unde e marfa — cel mult trei depozite, restul ca „+N". */}
      <div className="min-w-0 text-sm">
        {inStock.length === 0 ? (
          <span className="rounded-md bg-[#fef2f2] px-2 py-0.5 font-medium text-[#b91c1c]">Lipsă din stoc</span>
        ) : (
          <>
            <span className="rounded-md bg-[#f0fdf4] px-2 py-0.5 font-medium text-[#166534]">
              În stoc: <span className="font-semibold tabular-nums">{product.total}</span> buc.
            </span>
            <span className="mt-0.5 block truncate text-[#52525b]">
              {inStock
                .slice(0, 3)
                .map((stock) => `${stock.name} ${stock.quantity}`)
                .join(" · ")}
              {inStock.length > 3 ? ` · +${inStock.length - 3}` : null}
            </span>
          </>
        )}
      </div>
      <p className="text-lg font-semibold tabular-nums text-[#18181b] md:text-right">
        {product.price ?? <span className="text-sm font-normal text-[#71717a]">fără preț</span>}
      </p>
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
