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
  const key = [params.brand, params.model, params.type, params.year, params.stoc, params.page].join(":");

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

      <Suspense key={key} fallback={<WorkspaceSkeleton filters={5} rows={8} />}>
        <ProductWorkspaceLoader catalogPromise={catalogPromise} canModify={canModify} canSell={canSell} />
      </Suspense>
    </>
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
      <CatalogFilters brands={catalog.brands} models={catalog.models} types={catalog.types} />
      <section className="motion-page grid grid-cols-1 gap-4 p-3 lg:px-6 lg:py-4">
        <LabelPicker>
          <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
            <div className="overflow-x-auto">
              <table className="crm-table w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
                  <tr>
                    {canModify ? (
                      <TableHead>
                        <span className="sr-only">Selectează pentru sticker</span>
                      </TableHead>
                    ) : null}
                    <TableHead>Cod</TableHead>
                    <TableHead className="min-w-[18rem]">Mașină și piesă</TableHead>
                    <TableHead align="right">Preț vânzare</TableHead>
                    <TableHead align="right">Stoc</TableHead>
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

/** Stocul ca etichetă cu punct: verde în stoc, galben aproape terminat, roșu lipsă. */
function StockCount({ stock, minStock }: { stock: number | null; minStock: number | null }) {
  const value = stock ?? 0;
  // Același prag ca filtrul „aproape terminate": minStock, implicit 3.
  const tone =
    value <= 0
      ? "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]"
      : value <= (minStock ?? 3)
        ? "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]"
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

  return (
    <tr className="motion-table-row border-t border-[#f0f0f2] hover:bg-[#fafafa]">
      {canModify ? (
        <TableCell>
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
      <TableCell className="whitespace-nowrap">
        {/* Codul e cheia piesei: după el se caută și se comandă. */}
        {product.externalCode ? (
          <CopyCode code={product.externalCode} className="font-mono text-[15px] font-bold text-[#18181b]" />
        ) : (
          <p className="font-mono text-[15px] font-bold text-[#18181b]">—</p>
        )}
        {product.alternativeCode ? (
          <p className="mt-0.5 font-mono text-xs text-[#71717a]">{product.alternativeCode}</p>
        ) : null}
      </TableCell>
      <TableCell>
        {/* Întâi mașina (după ea întreabă clientul), apoi piesa. Click: fișa cu
            stocul pe fiecare depozit și toate mașinile. */}
        <ProductPreview product={toPreview(product, catalog, compatibilities)} canModify={canModify} canSell={canSell}>
          {/* TOATE mașinile, fiecare pe rândul ei — un „+1" ascundea gemenii
              (Sprinter ↔ Crafter) și părea că s-au șters. Cea căutată vine prima. */}
          {(compatibilities.length > 0
            ? matchingFirst(compatibilities, catalog.params.q)
            : [{ title: "—", years: "" }]
          ).map((compatibility, index) => (
            <span
              key={`${compatibility.title}:${compatibility.years}:${index}`}
              className="flex items-center gap-1.5 font-semibold text-[#18181b] hover:text-[#2563eb] hover:underline"
            >
              <Car className="size-3.5 shrink-0 text-[#a1a1aa]" aria-hidden="true" />
              {compatibility.title} {compatibility.years}
            </span>
          ))}
          <span className="mt-0.5 block pl-5 text-[#3f3f46]">
            {product.description}
            {product.isLocal ? <LocalBadge className="ml-2 align-middle" /> : null}
          </span>
        </ProductPreview>
      </TableCell>
      <TableCell align="right" className="text-[15px] font-semibold tabular-nums text-[#18181b]">
        {product.salePriceLei != null ? `${formatMoney(product.salePriceLei)} lei` : "—"}
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">
        <StockCount stock={product.stock} minStock={product.minStock} />
      </TableCell>
      {canModify ? (
        <TableCell align="right" secondary className="tabular-nums text-[#52525b]">
          {formatMoney(product.costLei)} lei
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
