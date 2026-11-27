import Link from "next/link";
import { Suspense } from "react";
import { Car, ChevronDown } from "lucide-react";
import { BrandLogo, brandLabel, brandLogoSrc } from "@/app/components/brand-logo";
import { CopyCode } from "@/app/components/copy-code";
import { LocalBadge } from "@/app/components/local-badge";
import { CatalogFilters } from "@/app/catalog/catalog-filters";
import { ProductDeleteButton } from "@/app/catalog/product-delete-button";
import { RowMenu } from "@/app/components/row-menu";
import { ProductFormDialog, type ProductFormValue } from "@/app/catalog/product-form-dialog";
import { LabelPicker } from "@/app/catalog/label-picker";
import { buildCompatibilityLines } from "@/lib/catalog/compatibility-display";
import { normalizeText, searchTerms } from "@/lib/catalog/search-text";
import { getCatalogData, type CatalogSearchParams } from "@/lib/catalog/queries";
import { crmCatalogPageHref, crmSectionHref } from "@/lib/crm/urls";
import { canCreateSales, canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import {
  ButtonSkeleton,
  Pagination,
  ExportLink,
  TableCell,
  TableHead,
  WorkspaceSkeleton,
} from "../_components/ui";
import { formatFormValue, formatMoney, formatNumber } from "../_components/format";
import { ProductPreview, type ProductPreviewValue } from "./product-preview";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CatalogData = Awaited<ReturnType<typeof getCatalogData>>;
type CatalogProduct = CatalogData["products"][number];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const appUser = await requireCrmSection("produse");
  const params = await searchParams;
  const canModify = canWriteCatalog(appUser.role);
  const canSell = canCreateSales(appUser.role);
  const catalogPromise = getCatalogData(params, {
    onlyInStock: appUser.role === "ANGAJAT",
  });
  // Fără `q`: căutarea filtrează pe măsură ce scrii, iar o cheie nouă ar
  // remonta câmpul (pierde focusul) și ar arăta scheletul la fiecare literă.
  const key = [params.brand, params.model, params.fitment, params.type, params.year, params.stoc, params.page].join(":");

  return (
    <>
      <CrmHeader
        section="produse"
        role={appUser.role}
      >
        <ExportLink href="/api/export/products" label="Export Excel" />
        {canModify ? (
          <Suspense fallback={<ButtonSkeleton />}>
            <ProductHeaderAction catalogPromise={catalogPromise} />
          </Suspense>
        ) : null}
      </CrmHeader>

      {/* Desktop: mașinile în stânga. Suspense fără cheie: la un click
          panoul rămâne pe loc, doar lista se reîncarcă. */}
      <div className="products-layout gap-4 px-3 pt-4 lg:px-6 xl:grid xl:grid-cols-[14.5rem_minmax(0,1fr)] xl:items-start">
        <Suspense fallback={<div className="max-xl:hidden" />}>
          <BrandTreeLoader catalogPromise={catalogPromise} />
        </Suspense>
        <div className="min-w-0">
          <Suspense key={key} fallback={<WorkspaceSkeleton filters={5} rows={8} />}>
            <ProductWorkspaceLoader catalogPromise={catalogPromise} canModify={canModify} canSell={canSell} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

/**
 * Mașinile în stânga: click pe marcă deschide sub ea modelele ei; click pe
 * marca sau modelul ales îl scoate. Tipul piesei se alege sus.
 */
async function BrandTreeLoader({ catalogPromise }: { catalogPromise: Promise<CatalogData> }) {
  const { params, brands, models } = await catalogPromise;
  const href = (brand?: string, model?: string) =>
    crmCatalogPageHref({ ...params, brand, model, fitment: undefined, page: undefined });
  const row = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
      active ? "bg-(--c-accent-soft) font-semibold text-(--c-accent-strong)" : "text-(--c-ink-2) hover:bg-(--c-hover) hover:text-(--c-ink)"
    }`;

  return (
    <nav
      aria-label="Mașini"
      className="products-brand-tree crm-card sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto p-2 max-xl:hidden"
    >
      <Link href={href()} className={row(!params.brand)} aria-current={!params.brand ? "page" : undefined}>
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-(--c-hover) text-(--c-muted-2)">
          <Car className="size-3.5" aria-hidden="true" />
        </span>
        <span>Toate mașinile</span>
      </Link>
      <ul className="mt-0.5 grid gap-0.5">
        {brands.map((brand) => {
          const open = brand.id === params.brand;
          return (
            <li key={brand.id}>
              <Link
                href={open ? href() : href(brand.id)}
                className={row(open && !params.model)}
                aria-current={open && !params.model ? "page" : undefined}
                aria-expanded={open}
              >
                <BrandLogo name={brand.name} />
                <span className="min-w-0 flex-1 truncate">{brandLabel(brand.name)}</span>
                <ChevronDown
                  className={`size-3.5 shrink-0 text-(--c-faint) transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </Link>
              {open && models.length > 0 ? (
                <ul className="crm-tree-submenu my-1 ml-5 grid gap-0.5 border-l border-(--c-line) pl-2">
                  {models.map((model) => {
                    const active = model.id === params.model;
                    return (
                      <li key={model.id}>
                        <Link
                          href={active ? href(brand.id) : href(brand.id, model.id)}
                          className={row(active)}
                          aria-current={active ? "page" : undefined}
                        >
                          <span className="truncate">{model.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Marca din titlul „MARCĂ MODEL" al unei compatibilități. */
function carBrand(title: string, brands: { name: string }[]) {
  return brands.find((brand) => title.startsWith(`${brand.name} `))?.name;
}

/** „AUDI A4" → „Audi A4": marca scrisă ca în lista din stânga, modelul neatins. */
function withBrandLabel(title: string, brand: string | undefined) {
  return brand && title.startsWith(brand) ? brandLabel(brand) + title.slice(brand.length) : title;
}

async function ProductWorkspaceLoader({
  catalogPromise,
  canModify,
  canSell,
}: {
  catalogPromise: Promise<CatalogData>;
  canModify: boolean;
  canSell: boolean;
}) {
  const catalog = await catalogPromise;
  return <ProductWorkspace catalog={catalog} canModify={canModify} canSell={canSell} />;
}

async function ProductHeaderAction({
  catalogPromise,
}: {
  catalogPromise: Promise<CatalogData>;
}) {
  const catalog = await catalogPromise;

  return (
    <ProductFormDialog
      brands={catalog.brands}
      models={catalog.models}
      types={catalog.types}
      warehouses={catalog.warehouses}
      triggerLabel="Adaugă produs"
    />
  );
}

function ProductWorkspace({
  catalog,
  canModify,
  canSell,
}: {
  catalog: CatalogData;
  canModify: boolean;
  canSell: boolean;
}) {
  const { page, pageCount, pageSize } = catalog.pagination;
  const start = catalog.productCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, catalog.productCount);

  return (
    <section className="motion-page">
      <LabelPicker>
        <div className="crm-card overflow-hidden">
          <CatalogFilters
            brands={catalog.brands}
            models={catalog.models}
            fitments={catalog.fitments}
            types={catalog.types}
          />
          <div className="overflow-x-auto">
            <table className="crm-table crm-table-compact w-full table-fixed border-collapse text-left text-sm lg:table-auto lg:min-w-[720px]">
              <thead className="border-y border-(--c-line) bg-(--c-surface-2) max-lg:hidden">
                <tr>
                  {canModify ? (
                    <TableHead className="max-lg:hidden">
                      <span className="sr-only">Selectează pentru sticker</span>
                    </TableHead>
                  ) : null}
                  <TableHead className="max-lg:hidden">Cod</TableHead>
                  <TableHead className="lg:min-w-[12rem]">
                    Piesă
                  </TableHead>
                  <TableHead className="max-lg:hidden">Mașină și ani</TableHead>
                  <TableHead align="right" className="max-lg:hidden">Stoc</TableHead>
                  {canModify ? <TableHead align="right" secondary>Cost</TableHead> : null}
                  <TableHead align="right" className="max-lg:hidden">Preț</TableHead>
                  {canModify ? (
                    <TableHead align="right" className="max-lg:hidden">
                      <span className="sr-only">Acțiuni</span>
                    </TableHead>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {catalog.products.map((product) => (
                  <ProductRow
                    key={product.id}
                    canModify={canModify}
                    canSell={canSell}
                    catalog={catalog}
                    product={product}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {catalog.products.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-(--c-muted)">
              Nu am găsit nimic.{" "}
              <Link className="font-medium text-(--c-accent) hover:underline" href={crmSectionHref("produse")}>
                Resetează filtrele
              </Link>
            </div>
          ) : null}
          <div className="border-t border-(--c-line) px-4 py-3">
            <Pagination
              page={page}
              pageCount={pageCount}
              hrefFor={(target) => crmCatalogPageHref({ ...catalog.params, page: target })}
              summary={`${start}–${end} din ${formatNumber(catalog.productCount)} piese`}
            />
          </div>
        </div>
      </LabelPicker>
    </section>
  );
}

/**
 * Stocul ca insignă: verde în stoc, albastru aproape terminat, roșu lipsă.
 * Albastru, nu galben: pe monitorul din magazin galbenul-portocaliu și roșul
 * se confundau.
 */
function StockCount({
  stock,
  minStock,
  unit = false,
}: {
  stock: number | null;
  minStock: number | null;
  /** Pe telefon nu există hover pe insignă: „buc." spune ce e cifra. */
  unit?: boolean;
}) {
  const value = stock ?? 0;
  // Același prag ca filtrul „aproape terminate": minStock, implicit 3.
  const [tone, label] =
    value <= 0
      ? ["bg-(--c-red-soft) text-(--c-red)", "Fără stoc"]
      : value <= (minStock ?? 3)
        ? ["bg-(--c-accent-soft) text-(--c-accent-strong)", "Aproape terminat"]
        : ["bg-(--c-green-soft) text-(--c-green)", "În stoc"];
  return (
    <span
      title={label}
      className={`inline-flex min-w-9 items-baseline justify-center rounded-lg px-2 py-1 text-sm font-semibold leading-none tabular-nums ${tone}`}
    >
      {formatNumber(value)}
      {unit ? <span className="ml-0.5 text-xs font-medium opacity-70">buc.</span> : null}
    </span>
  );
}

function ProductRow({
  canModify,
  canSell,
  catalog,
  product,
}: {
  canModify: boolean;
  canSell: boolean;
  catalog: CatalogData;
  product: CatalogProduct;
}) {
  // Produsele vechi pot avea doar mașina principală, fără legături suplimentare.
  const compatibilities = buildCompatibilityLines(
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
  );
  // TOATE mașinile, fiecare pe rândul ei — un „+1" ascundea gemenii
  // (Sprinter ↔ Crafter) și părea că s-au șters. Cea căutată vine prima.
  // Ce e ales în stânga nu se mai repetă pe fiecare rând: cu marca aleasă
  // dispare marca, cu modelul ales rămân doar anii.
  const filteredBrand = catalog.brands.find((brand) => brand.id === catalog.params.brand)?.name;
  const filteredModel = catalog.models.find((model) => model.id === catalog.params.model)?.name;
  const prefix = filteredBrand && filteredModel ? `${filteredBrand} ${filteredModel}` : filteredBrand;
  const cars = matchingFirst(compatibilities, catalog.params.q).map((compatibility) => ({
    ...compatibility,
    // Logo-ul doar cât marca nu e deja aleasă în stânga.
    brand: filteredBrand ? null : (carBrand(compatibility.title, catalog.brands) ?? null),
    title: withBrandLabel(withoutPrefix(compatibility.title, prefix), filteredBrand ? undefined : carBrand(compatibility.title, catalog.brands)),
  }));

  return (
    <tr className="motion-table-row border-t border-(--c-line-2) hover:bg-(--c-surface-2)">
      {canModify ? (
        <TableCell className="w-10 max-lg:hidden">
          <input
            type="checkbox"
            data-label-id={product.id}
            data-label-code={product.externalCode ?? "—"}
            data-label-alternative-code={product.alternativeCode ?? ""}
            data-label-name={product.description}
            data-label-compatibility={compatibilities
              .map((compatibility) => `${compatibility.title}, ani ${compatibility.years}`)
              .join(" • ")}
            aria-label={`Selectează ${product.description} pentru sticker`}
            className="size-4 cursor-pointer rounded accent-(--c-accent)"
          />
        </TableCell>
      ) : null}
      <TableCell className="whitespace-nowrap max-lg:hidden">
        {/* Codul e cheia piesei: îl afișăm primul și mai vizibil decât denumirea. */}
        {product.externalCode ? (
          <CopyCode code={product.externalCode} className="font-mono text-[0.9375rem] font-bold text-(--c-ink-2)" />
        ) : (
          <span className="text-(--c-line-strong)">—</span>
        )}
        {product.alternativeCode ? (
          <p className="mt-0.5 font-mono text-xs text-(--c-faint)">{product.alternativeCode}</p>
        ) : null}
      </TableCell>
      <TableCell>
        {/* Pe telefon: codul, cu prețul și stocul pe același rând; dedesubt
            denumirea și mașinile. Un rând în minus = mai multe piese pe ecran. */}
        <div className="mb-0.5 flex items-center justify-between gap-3 lg:hidden">
          {product.externalCode ? (
            <CopyCode code={product.externalCode} className="min-w-0 truncate font-mono text-lg font-bold text-(--c-ink-2)" />
          ) : (
            <span className="text-sm text-(--c-faint)">fără cod</span>
          )}
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[0.9375rem] font-semibold tabular-nums text-(--c-ink)">
              {product.salePriceLei != null ? <Lei value={product.salePriceLei} /> : <span className="font-normal text-(--c-faint)">fără preț</span>}
            </span>
            <StockCount stock={product.stock} minStock={product.minStock} unit />
          </span>
        </div>
        {/* Click pe denumire deschide fișa cu stocul și compatibilitățile. */}
        <ProductPreview
          product={toPreview(product, catalog, compatibilities)}
          canModify={canModify}
          canSell={canSell}
          editButton={
            <ProductFormDialog
              brands={catalog.brands}
              models={catalog.models}
              product={toProductFormValue(product)}
              triggerKind="secondary"
              triggerLabel="Editează"
              types={catalog.types}
              warehouses={catalog.warehouses}
            />
          }
        >
          <span className="block text-sm text-(--c-ink-2) hover:text-(--c-accent)">
            {product.description}
            {product.isLocal ? <LocalBadge className="ml-2 align-middle" /> : null}
          </span>
        </ProductPreview>
        <div className="mt-0.5 lg:hidden">
          <CarLines lines={cars} compact />
        </div>
      </TableCell>
      <TableCell className="max-lg:hidden">
        <CarLines lines={cars} />
      </TableCell>
      <TableCell align="right" className="max-lg:hidden">
        <StockCount stock={product.stock} minStock={product.minStock} />
      </TableCell>
      {canModify ? (
        <TableCell align="right" secondary className="whitespace-nowrap tabular-nums text-(--c-muted-2)">
          {product.costLei != null ? <Lei value={product.costLei} /> : <span className="text-(--c-line-strong)">—</span>}
        </TableCell>
      ) : null}
      <TableCell align="right" className="whitespace-nowrap text-[0.9375rem] font-semibold tabular-nums text-(--c-ink) max-lg:hidden">
        {product.salePriceLei != null ? <Lei value={product.salePriceLei} /> : <span className="font-normal text-(--c-line-strong)">—</span>}
      </TableCell>
      {canModify ? (
        <TableCell align="right" className="max-lg:hidden">
          <div className="flex justify-end gap-1.5">
            <ProductFormDialog
              brands={catalog.brands}
              models={catalog.models}
              product={toProductFormValue(product)}
              triggerKind="row"
              triggerLabel="Editează"
              types={catalog.types}
              warehouses={catalog.warehouses}
            />
            <RowMenu label={product.description}>
              <ProductDeleteButton productId={product.id} label={product.description} />
            </RowMenu>
          </div>
        </TableCell>
      ) : null}
    </tr>
  );
}


/** Suma în față, „lei" estompat: ochiul citește cifra, nu moneda repetată. */
function Lei({ value }: { value: Parameters<typeof formatMoney>[0] }) {
  return (
    <>
      {formatMoney(value)} <span className="text-[0.85em] font-normal text-(--c-faint)">lei</span>
    </>
  );
}

/** Mașina și anii, câte una pe rând, cu logo-ul mărcii în față. */
function CarLines({
  lines,
  compact = false,
}: {
  lines: { title: string; years: string; brand: string | null }[];
  compact?: boolean;
}) {
  if (lines.length === 0) return <span className="text-(--c-line-strong)">—</span>;
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((line, index) => (
        <li key={`${line.title}:${line.years}:${index}`} className={`flex items-center gap-2 ${compact ? "min-w-0 flex-wrap" : ""}`}>
          {line.brand ? <BrandLogo name={line.brand} className="size-5" /> : null}
          {line.title ? <span className={`${compact ? "min-w-0 break-words" : "whitespace-nowrap"} text-(--c-ink-2)`}>{line.title}</span> : null}
          <span className="whitespace-nowrap tabular-nums text-(--c-faint)">{line.years}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * „MERCEDES-BENZ SPRINTER 906" → „SPRINTER 906" cu marca aleasă sus; cu și
 * modelul ales, titlul rămâne gol și se văd doar anii.
 */
function withoutPrefix(title: string, prefix: string | undefined) {
  if (!prefix) return title;
  const lower = title.toLocaleLowerCase("ro");
  const wanted = prefix.toLocaleLowerCase("ro");
  if (lower === wanted) return "";
  return lower.startsWith(`${wanted} `) ? title.slice(wanted.length + 1) : title;
}

/** Mașinile care se potrivesc cu căutarea întâi (caut „crafter" → Crafter sus). */
function matchingFirst<T extends { title: string }>(lines: T[], query: string | undefined) {
  const terms = searchTerms(query ?? "");
  if (terms.length === 0) return lines;
  const matches = (line: T) => terms.some((term) => normalizeText(line.title).includes(term));
  return [...lines.filter(matches), ...lines.filter((line) => !matches(line))];
}

function toProductFormValue(product: CatalogProduct): ProductFormValue {
  return {
    id: product.id,
    externalCode: product.externalCode ?? "",
    alternativeCode: product.alternativeCode ?? "",
    brandId: product.fitment.carModel.brand.id,
    modelId: product.fitment.carModel.id,
    typeId: product.type.id,
    description: product.description,
    descriptionRu: product.descriptionRu ?? "",
    notes: product.notes ?? "",
    notesRu: product.notesRu ?? "",
    yearStart: formatFormValue(product.fitment.yearStart),
    yearEnd: formatFormValue(product.fitment.yearEnd),
    yearOpenEnded: product.fitment.yearOpenEnded,
    // Legăturile suplimentare (fără fitmentul principal, care are câmpurile lui).
    extraFitments: product.productFitments
      .filter(({ fitment }) => fitment.id !== product.fitmentId)
      .map(({ fitment }) => ({
        brandId: fitment.carModel.brand.id,
        modelId: fitment.carModel.id,
        yearStart: formatFormValue(fitment.yearStart),
        yearEnd: formatFormValue(fitment.yearEnd),
        yearOpenEnded: fitment.yearOpenEnded,
      })),
    isLocal: product.isLocal,
    warehouseStocks: product.warehouseStocks.map((stock) => ({
      warehouseId: stock.warehouseId,
      quantity: formatFormValue(stock.quantity),
    })),
    minStock: formatFormValue(product.minStock),
    priceEuro: formatFormValue(product.priceEuro),
    costLei: formatFormValue(product.costLei),
    salePriceLei: formatFormValue(product.salePriceLei),
  };
}

function toPreview(
  product: CatalogProduct,
  catalog: CatalogData,
  compatibilities: ReturnType<typeof buildCompatibilityLines>,
): ProductPreviewValue {
  const stocks = catalog.warehouses.map((warehouse) => ({
    id: warehouse.id,
    name: warehouse.name,
    quantity: product.warehouseStocks.find((stock) => stock.warehouseId === warehouse.id)?.quantity ?? 0,
  }));
  return {
    id: product.id,
    code: product.externalCode,
    alternativeCode: product.alternativeCode,
    description: product.description,
    type: product.type.name,
    compatibilities: compatibilities.map((line) => {
      const brand = carBrand(line.title, catalog.brands);
      return { ...line, logo: brand ? brandLogoSrc(brand) : null };
    }),
    stocks,
    total: stocks.reduce((sum, stock) => sum + stock.quantity, 0),
    price: product.salePriceLei != null ? `${formatMoney(product.salePriceLei)} lei` : null,
    notes: product.notes,
  };
}
