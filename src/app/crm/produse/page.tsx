import Link from "next/link";
import { Suspense } from "react";
import { Printer } from "lucide-react";
import { LocalBadge } from "@/app/components/local-badge";
import { CatalogFilters } from "@/app/catalog/catalog-filters";
import { ProductDeleteButton } from "@/app/catalog/product-delete-button";
import { RowMenu } from "@/app/components/row-menu";
import { ProductFormDialog, type ProductFormValue } from "@/app/catalog/product-form-dialog";
import { LabelPicker } from "@/app/catalog/label-picker";
import { buildCompatibilityLines } from "@/lib/catalog/compatibility-display";
import { getCatalogData, type CatalogSearchParams } from "@/lib/catalog/queries";
import { crmCatalogPageHref, crmSectionHref } from "@/lib/crm/urls";
import { canWriteCatalog } from "@/lib/roles";
import { CrmHeader } from "../_components/section-header";
import { requireCrmSection } from "../_components/guard";
import {
  ButtonSkeleton,
  DailyMetric,
  Pagination,
  ExportLink,
  TableCell,
  TableHead,
  WorkspaceSkeleton,
} from "../_components/ui";
import { formatFormValue, formatMoney, formatNumber, formatText } from "../_components/format";

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
  const catalogPromise = getCatalogData(params, {
    onlyInStock: appUser.role === "ANGAJAT",
  });
  const key = [params.q, params.brand, params.model, params.type, params.year, params.page].join(":");

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
        <ProductWorkspaceLoader catalogPromise={catalogPromise} canModify={canModify} />
      </Suspense>
    </>
  );
}

async function ProductWorkspaceLoader({
  catalogPromise,
  canModify,
}: {
  catalogPromise: Promise<CatalogData>;
  canModify: boolean;
}) {
  const catalog = await catalogPromise;
  return <ProductWorkspace catalog={catalog} canModify={canModify} />;
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
}: {
  catalog: CatalogData;
  canModify: boolean;
}) {
  const { page, pageCount, pageSize } = catalog.pagination;
  const start = catalog.productCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, catalog.productCount);

  return (
    <>
      <CatalogFilters brands={catalog.brands} models={catalog.models} types={catalog.types} />
      <section className="motion-page grid grid-cols-1 gap-4 p-3 lg:px-6 lg:py-4">
        <div className="stat-strip grid grid-cols-2 lg:grid-cols-4">
          <DailyMetric label="Produse" value={formatNumber(catalog.productCount)} hint="pentru filtrele curente" />
          <DailyMetric label="Bucăți în stoc" value={formatNumber(catalog.stats.totalUnits)} hint="toate depozitele" />
          <DailyMetric
            label="Stoc mic"
            value={formatNumber(catalog.stats.criticalStockCount)}
            hint="sub pragul de alertă"
          />
          <DailyMetric label="Fără stoc" value={formatNumber(catalog.stats.outOfStockCount)} hint="0 bucăți" />
        </div>

        <LabelPicker>
          <div className="overflow-hidden rounded-xl border border-[#e4e4e7] bg-white">
            <div className="overflow-x-auto">
              <table className="crm-table w-full min-w-[960px] border-collapse text-left text-sm">
                <thead className="border-b border-[#e4e4e7] bg-[#fafafa]">
                  <tr>
                    {canModify ? (
                      <TableHead>
                        <span className="sr-only">Selectează pentru sticker</span>
                      </TableHead>
                    ) : null}
                    <TableHead className="min-w-[16rem]">Produs</TableHead>
                    <TableHead secondary>Compatibilitate</TableHead>
                    <TableHead align="right">Preț vânzare</TableHead>
                    <TableHead align="right">Stoc</TableHead>
                    <TableHead>Status</TableHead>
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
                      catalog={catalog}
                      product={product}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {catalog.products.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-[#52525b]">
                Nu sunt produse pentru filtrele curente.{" "}
                <Link className="font-medium text-[#2563eb] hover:underline" href={crmSectionHref("produse")}>
                  Resetează filtrele
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

function StockBreakdown({ entries }: { entries: { id: string; name: string; quantity: number }[] }) {
  if (entries.length === 0) return null;
  const all = entries.map((entry) => `${entry.name}: ${entry.quantity}`).join(", ");
  return (
    <p className="mt-0.5 whitespace-nowrap text-xs font-normal text-[#52525b]" title={all}>
      {entries
        .slice(0, 3)
        .map((entry) => `${entry.name} ${entry.quantity}`)
        .join(" · ")}
      {entries.length > 3 ? ` · +${entries.length - 3}` : null}
    </p>
  );
}

/** Statusul de stoc, ca în tabelele de magazin: în stoc / stoc mic / lipsă. */
function StockStatus({ stock, minStock }: { stock: number | null; minStock: number | null }) {
  const value = stock ?? 0;
  const [label, tone] =
    value <= 0
      ? ["Lipsă", "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]"]
      : value <= (minStock ?? 3)
        ? ["Stoc mic", "bg-[#fffbeb] text-[#92400e] ring-[#fde68a]"]
        : ["În stoc", "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]"];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}>
      {label}
    </span>
  );
}

function ProductRow({
  canModify,
  catalog,
  product,
}: {
  canModify: boolean;
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
    <tr className="motion-table-row border-t border-[#f0f0f2] align-top hover:bg-[#fafafa]">
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
      <TableCell>
        <p className="font-medium text-[#18181b]">
          {product.description}
          {product.isLocal ? <LocalBadge className="ml-2 align-middle" /> : null}
        </p>
        <p className="mt-0.5 text-xs text-[#52525b]">
          <span className="font-mono font-semibold text-[#3f3f46]">{formatText(product.externalCode)}</span>
          {" · "}
          {product.type.name}
        </p>
      </TableCell>
      <TableCell secondary>
        <div className="space-y-1">
          {compatibilities.map((compatibility, index) => (
            <div key={`${compatibility.title}:${compatibility.years}:${index}`}>
              <p className="text-[#18181b]">{compatibility.title}</p>
              <p className="text-xs text-[#52525b]">{compatibility.years}</p>
            </div>
          ))}
        </div>
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">
        {product.salePriceLei != null ? `${formatMoney(product.salePriceLei)} lei` : "—"}
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">
        {formatNumber(product.stock)}
        {/* Doar depozitele cu marfă, pe un rând (primele trei, restul ca „+N"). */}
        <StockBreakdown
          entries={catalog.warehouses
            .map((warehouse) => ({
              id: warehouse.id,
              name: warehouse.name.replace("Pavilion ", ""),
              quantity:
                product.warehouseStocks.find((stock) => stock.warehouseId === warehouse.id)?.quantity ?? 0,
            }))
            .filter((entry) => entry.quantity > 0)}
        />
      </TableCell>
      <TableCell>
        {/* Același prag ca filtrul „stoc mic": minStock, implicit 3. */}
        <StockStatus stock={product.stock} minStock={product.minStock} />
      </TableCell>
      {canModify ? (
        <TableCell align="right" secondary className="tabular-nums text-[#52525b]">
          <p>{formatMoney(product.costLei)} lei</p>
          <p className="mt-0.5 text-xs">{formatMoney(product.priceEuro)} EUR</p>
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

