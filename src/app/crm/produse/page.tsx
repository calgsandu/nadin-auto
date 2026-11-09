import Link from "next/link";
import { Suspense } from "react";
import { Car, Printer } from "lucide-react";
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
      <CrmHeader section="produse" role={appUser.role}>
        <ExportLink href="/api/export/products" label="Export Excel" />
        {canModify ? (
          <Suspense fallback={<ButtonSkeleton />}>
            <ProductHeaderAction catalogPromise={catalogPromise} />
          </Suspense>
        ) : null}
      </CrmHeader>

      {/* Desktop: tipurile de piese în stânga. Suspense fără cheie: la un click
          panoul rămâne pe loc, doar lista se reîncarcă. */}
      <div className="xl:grid xl:grid-cols-[12rem_minmax(0,1fr)] xl:items-start">
        <Suspense fallback={<div className="max-xl:hidden" />}>
          <TypeTreeLoader catalogPromise={catalogPromise} />
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
 * Ca la Polcar: mașina se alege sus, iar în stânga stau tipurile de piese care
 * există pentru ea, cu câte bucăți are fiecare. Click pe tipul ales îl scoate.
 */
async function TypeTreeLoader({ catalogPromise }: { catalogPromise: Promise<CatalogData> }) {
  const catalog = await catalogPromise;
  const { params, typeCounts } = catalog;
  const href = (type?: string) => crmCatalogPageHref({ ...params, type, page: undefined });
  const types = catalog.types.filter((type) => (typeCounts.get(type.id) ?? 0) > 0);
  const total = [...typeCounts.values()].reduce((sum, count) => sum + count, 0);
  const row = (active: boolean) =>
    `flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[13px] ${
      active ? "bg-[#eff6ff] font-semibold text-[#1d4ed8]" : "text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#18181b]"
    }`;
  const count = (value: number) => (
    <span className="rounded-full bg-[#f4f4f5] px-1.5 text-xs font-medium tabular-nums text-[#52525b]">
      {formatNumber(value)}
    </span>
  );

  return (
    <nav
      aria-label="Tipuri de piese"
      className="sticky top-0 max-h-[100dvh] overflow-y-auto border-r border-[#e4e4e7] py-4 pl-3 pr-2 max-xl:hidden"
    >
      <p className="px-2 pb-1.5 text-[13px] font-medium text-[#71717a]">Tip piesă</p>
      <Link href={href()} className={row(!params.type)} aria-current={!params.type ? "page" : undefined}>
        <span>Toate piesele</span>
        {count(total)}
      </Link>
      <ul className="mt-1 grid gap-px">
        {types.map((type) => {
          const active = type.id === params.type;
          return (
            <li key={type.id}>
              <Link
                href={active ? href() : href(type.id)}
                className={row(active)}
                aria-current={active ? "page" : undefined}
              >
                <span className="truncate">{type.name}</span>
                {count(typeCounts.get(type.id) ?? 0)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
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
    <>
      <CatalogFilters
        brands={catalog.brands}
        models={catalog.models}
        fitments={catalog.fitments}
        types={catalog.types}
      />
      <section className="motion-page grid grid-cols-1 gap-4 p-3 lg:px-6 lg:py-4">
        <LabelPicker>
          <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
            <div className="overflow-x-auto">
              <table className="crm-table w-full border-collapse text-left text-sm sm:min-w-[720px]">
                <thead className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                  <tr>
                    {canModify ? (
                      <TableHead className="max-sm:hidden">
                        <span className="sr-only">Selectează pentru sticker</span>
                      </TableHead>
                    ) : null}
                    <TableHead className="max-sm:hidden">Cod</TableHead>
                    <TableHead className="sm:min-w-[16rem]">Piesă</TableHead>
                    <TableHead className="max-sm:hidden">Mașină și ani</TableHead>
                    <TableHead align="right" className="max-sm:hidden">Preț vânzare</TableHead>
                    <TableHead align="right" className="max-sm:hidden">Stoc</TableHead>
                    {canModify ? <TableHead align="right" secondary>Cost aducere</TableHead> : null}
                    {canModify ? (
                      <TableHead align="right">
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
              <div className="px-4 py-12 text-center text-sm text-[#52525b]">
                Nu am găsit nimic.{" "}
                <Link className="font-medium text-[#2563eb] hover:underline" href={crmSectionHref("produse")}>
                  Resetează
                </Link>
              </div>
            ) : null}
          </div>
        </LabelPicker>

        <Pagination
          page={page}
          pageCount={pageCount}
          hrefFor={(target) => crmCatalogPageHref({ ...catalog.params, page: target })}
          summary={`${start}–${end} din ${formatNumber(catalog.productCount)} produse`}
        />
      </section>
    </>
  );
}

/**
 * Stocul ca etichetă cu punct: verde în stoc, albastru aproape terminat, roșu
 * lipsă. Albastru, nu galben: pe monitorul din magazin galbenul-portocaliu și
 * roșul se confundau.
 */
function StockCount({ stock, minStock }: { stock: number | null; minStock: number | null }) {
  const value = stock ?? 0;
  // Același prag ca filtrul „aproape terminate": minStock, implicit 3.
  const tone =
    value <= 0
      ? "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]"
      : value <= (minStock ?? 3)
        ? "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]"
        : "bg-[#f0fdf4] text-[#166534] ring-[#bbf7d0]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums ring-1 ring-inset ${tone}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {formatNumber(value)}
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
  // Ce e ales sus nu se mai repetă pe fiecare rând: cu marca aleasă dispare
  // marca, cu modelul ales rămân doar anii.
  const filteredBrand = catalog.brands.find((brand) => brand.id === catalog.params.brand)?.name;
  const filteredModel = catalog.models.find((model) => model.id === catalog.params.model)?.name;
  const prefix = filteredBrand && filteredModel ? `${filteredBrand} ${filteredModel}` : filteredBrand;
  const cars = matchingFirst(compatibilities, catalog.params.q).map((compatibility) => ({
    ...compatibility,
    title: withoutPrefix(compatibility.title, prefix),
  }));

  return (
    <tr className="motion-table-row border-t border-[#f0f0f2] even:bg-[#fafafa] hover:bg-[#f4f4f5]">
      {canModify ? (
        <TableCell className="max-sm:hidden">
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
            className="size-4 cursor-pointer accent-[#18181b]"
          />
        </TableCell>
      ) : null}
      <TableCell className="whitespace-nowrap max-sm:hidden">
        {/* Codul e cheia piesei: după el se caută și se comandă. */}
        {product.externalCode ? (
          <CopyCode code={product.externalCode} className="bg-[#f1f5f9] px-1.5 py-0.5 font-mono text-sm font-bold text-[#0f172a] ring-1 ring-inset ring-[#e2e8f0] xl:text-[15px]" />
        ) : (
          <p className="font-mono text-sm font-bold text-[#18181b] xl:text-[15px]">—</p>
        )}
        {product.alternativeCode ? (
          <p className="mt-0.5 font-mono text-xs text-[#71717a]">{product.alternativeCode}</p>
        ) : null}
      </TableCell>
      <TableCell>
        {/* Pe telefon coloanele Cod / Mașină / Preț / Stoc nu încap: codul vine
            deasupra, mașinile, prețul și stocul dedesubt, totul într-un bloc. */}
        {product.externalCode ? (
          <CopyCode code={product.externalCode} className="mb-1 font-mono text-[15px] font-bold text-[#18181b] sm:hidden" />
        ) : null}
        {/* Piesa e ce se citește întâi (ca în 1C): „Panou lateral L" mare, nu
            pierdut sub „MERCEDES-BENZ …" repetat pe fiecare rând. Click: fișa cu
            stocul pe fiecare depozit și toate mașinile. */}
        <ProductPreview product={toPreview(product, catalog, compatibilities)} canModify={canModify} canSell={canSell}>
          <span className="block text-[15px] font-semibold text-[#18181b] hover:text-[#2563eb] hover:underline lg:text-sm xl:text-[15px]">
            {product.description}
            {product.isLocal ? <LocalBadge className="ml-2 align-middle" /> : null}
          </span>
        </ProductPreview>
        <div className="mt-1 sm:hidden">
          <CarLines lines={cars} />
        </div>
        <div className="mt-1.5 flex items-center gap-2 sm:hidden">
          <span className="text-[15px] font-semibold tabular-nums text-[#18181b]">
            {product.salePriceLei != null ? <Lei value={product.salePriceLei} /> : "—"}
          </span>
          <StockCount stock={product.stock} minStock={product.minStock} />
        </div>
      </TableCell>
      <TableCell className="max-sm:hidden">
        <CarLines lines={cars} />
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap text-sm max-sm:hidden font-semibold tabular-nums text-[#18181b] xl:text-[15px]">
        {product.salePriceLei != null ? <Lei value={product.salePriceLei} /> : "—"}
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums max-sm:hidden">
        <StockCount stock={product.stock} minStock={product.minStock} />
      </TableCell>
      {canModify ? (
        <TableCell align="right" secondary className="tabular-nums text-[#52525b]">
          <Lei value={product.costLei} />
        </TableCell>
      ) : null}
      {canModify ? (
        <TableCell align="right">
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
              <a
                href={`/print/labels?ids=${product.id}`}
                target="_blank"
                rel="noreferrer"
                title="Sticker produs (70×50.8mm)"
                className="text-[#18181b]"
              >
                <Printer className="size-4 text-[#71717a]" aria-hidden="true" /> Sticker
              </a>
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
      {formatMoney(value)} <span className="text-[0.85em] font-normal text-[#a1a1aa]">lei</span>
    </>
  );
}

/** Mașina și anii, câte una pe rând, mai mici decât piesa. */
function CarLines({ lines }: { lines: { title: string; years: string }[] }) {
  if (lines.length === 0) return <span className="text-[#a1a1aa]">—</span>;
  return (
    <ul className="space-y-0.5 text-[13px] text-[#52525b]">
      {lines.map((line, index) => (
        <li key={`${line.title}:${line.years}:${index}`} className="flex items-center gap-1.5">
          <Car className="size-3.5 shrink-0 text-[#a78bfa]" aria-hidden="true" />
          {line.title ? <span className="font-medium text-[#3f3f46]">{line.title}</span> : null}
          <span className="whitespace-nowrap rounded bg-[#f5f3ff] px-1.5 text-xs font-medium tabular-nums text-[#6d28d9]">
            {line.years}
          </span>
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
    compatibilities,
    stocks,
    total: stocks.reduce((sum, stock) => sum + stock.quantity, 0),
    price: product.salePriceLei != null ? `${formatMoney(product.salePriceLei)} lei` : null,
    notes: product.notes,
  };
}
