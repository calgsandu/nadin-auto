import Link from "next/link";
import { Suspense } from "react";
import { Printer } from "lucide-react";
import { LocalBadge } from "@/app/components/local-badge";
import { CatalogFilters } from "@/app/catalog/catalog-filters";
import { ProductDeleteButton } from "@/app/catalog/product-delete-button";
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
      <section className="motion-page p-3 lg:p-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[#6f6b63]">
            {start}-{end} din {formatNumber(catalog.productCount)} produse
          </p>
          <Link
            className="text-sm font-medium text-[#1b1a17] underline decoration-[#2e90fa] underline-offset-4"
            href={crmSectionHref("produse")}
          >
            Resetează filtrele
          </Link>
        </div>

        <LabelPicker>
          <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
            <div className="overflow-x-auto">
              <table className="crm-table w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
                  <tr>
                    {canModify ? <TableHead>{""}</TableHead> : null}
                    <TableHead>Cod</TableHead>
                    <TableHead secondary>Compatibilitate</TableHead>
                    <TableHead>Produs</TableHead>
                    <TableHead align="right">Stoc</TableHead>
                    <TableHead align="right">Preț vânzare</TableHead>
                    {canModify ? <TableHead align="right" secondary>Cost aducere</TableHead> : null}
                    {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
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
              <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">
                Nu sunt produse pentru filtrele curente.
              </div>
            ) : null}
          </div>
        </LabelPicker>

        {catalog.productCount > pageSize ? (
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <p className="text-[#6f6b63]">
              Pagina {page} din {pageCount}
            </p>
            <div className="flex gap-2">
              <PaginationLink catalog={catalog} disabled={page <= 1} label="Înapoi" page={page - 1} />
              <PaginationLink
                catalog={catalog}
                disabled={page >= pageCount}
                label="Înainte"
                page={page + 1}
              />
            </div>
          </div>
        ) : null}
      </section>
    </>
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
  const compatibilities = buildCompatibilityLines(
    product.productFitments.map(({ fitment }) => ({
      id: fitment.id,
      brandName: fitment.carModel.brand.name,
      modelName: fitment.carModel.name,
      yearStart: fitment.yearStart,
      yearEnd: fitment.yearEnd,
      yearOpenEnded: fitment.yearOpenEnded,
    })),
  );

  return (
    <tr className="motion-table-row border-t border-[#efeeeb] align-top hover:bg-[#f6f6f4]">
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
            className="size-4 cursor-pointer accent-[#1b1a17]"
          />
        </TableCell>
      ) : null}
      <TableCell className="font-mono text-xs font-semibold">{formatText(product.externalCode)}</TableCell>
      <TableCell secondary>
        <div className="space-y-2">
          {compatibilities.map((compatibility, index) => (
            <div key={`${compatibility.title}:${compatibility.years}:${index}`}>
              <p className="font-semibold text-[#1b1a17]">{compatibility.title}</p>
              <p className="mt-0.5 text-xs text-[#6f6b63]">Ani: {compatibility.years}</p>
            </div>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <p className="font-medium text-[#1b1a17]">
          {product.description}
          {product.isLocal ? <LocalBadge className="ml-2 align-middle" /> : null}
        </p>
        <p className="mt-1 text-xs text-[#6f6b63]">{product.type.name}</p>
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">
        {formatNumber(product.stock)}
        <p className="mt-1 whitespace-nowrap font-normal text-xs text-[#6f6b63]">
          {catalog.warehouses
            .map((warehouse) => {
              const row = product.warehouseStocks.find((stock) => stock.warehouseId === warehouse.id);
              return `${warehouse.name.replace("Pavilion ", "")}: ${row?.quantity ?? 0}`;
            })
            .join(", ")}
        </p>
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">
        {product.salePriceLei != null ? `${formatMoney(product.salePriceLei)} lei` : "—"}
      </TableCell>
      {canModify ? (
        <TableCell align="right" secondary className="tabular-nums text-[#6f6b63]">
          <p>{formatMoney(product.costLei)} lei</p>
          <p className="mt-1 text-xs">{formatMoney(product.priceEuro)} EUR</p>
        </TableCell>
      ) : null}
      {canModify ? (
        <TableCell align="right">
          <div className="flex justify-end gap-2">
            <a
              href={`/print/labels?ids=${product.id}`}
              target="_blank"
              rel="noreferrer"
              title="Sticker produs (70×50.8mm)"
              aria-label="Sticker produs"
              className="button-secondary grid size-9 place-items-center rounded-md border border-[#e8e7e3] bg-white text-[#1b1a17] hover:bg-[#f6f6f4]"
            >
              <Printer className="size-4" aria-hidden="true" />
            </a>
            <ProductFormDialog
              brands={catalog.brands}
              models={catalog.models}
              product={toProductFormValue(product)}
              triggerKind="row"
              triggerLabel="Editează"
              types={catalog.types}
              warehouses={catalog.warehouses}
            />
            <ProductDeleteButton productId={product.id} label={product.description} />
          </div>
        </TableCell>
      ) : null}
    </tr>
  );
}


function PaginationLink({
  catalog,
  disabled,
  label,
  page,
}: {
  catalog: CatalogData;
  disabled: boolean;
  label: string;
  page: number;
}) {
  if (disabled) {
    return <span className="rounded-md border border-[#e3e1dc] bg-[#f0efec] px-3 py-2 text-[#98948b]">{label}</span>;
  }

  return (
    <Link
      className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-2 font-medium hover:bg-[#f6f6f4]"
      href={crmCatalogPageHref({ ...catalog.params, page })}
    >
      {label}
    </Link>
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

