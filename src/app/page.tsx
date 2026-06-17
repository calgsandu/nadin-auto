import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  ArrowRightLeft,
  BarChart3,
  CalendarRange,
  Car,
  ClipboardList,
  Download,
  FileText,
  Handshake,
  Layers,
  LogOut,
  PackagePlus,
  PackageSearch,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { CatalogFilters } from "@/app/catalog/catalog-filters";
import {
  ProductFormDialog,
  type ProductFormValue,
} from "@/app/catalog/product-form-dialog";
import { ProductDeleteButton } from "@/app/catalog/product-delete-button";
import { CurrencyWidget } from "@/app/rapoarte/currency-widget";
import {
  StockDocumentDialog,
  StockSaleDialog,
  StockTransferDialog,
  type WarehouseOption,
} from "@/app/operations/stock-document-dialog";
import {
  PartnerFormDialog,
  type PartnerFormValue,
} from "@/app/partners/partner-form-dialog";
import { PartnerDeleteButton } from "@/app/partners/partner-delete-button";
import { DocumentRowActions } from "@/app/operations/document-row-actions";
import { RoleForm, StaffDeleteButton } from "@/app/staff/role-form";
import {
  AdminDeleteButton,
  BrandDialog,
  FitmentDialog,
  ModelDialog,
  TypeDialog,
  WarehouseDialog,
} from "@/app/admin/admin-dialogs";
import {
  deleteBrandAction,
  deleteFitmentAction,
  deleteModelAction,
  deleteTypeAction,
  deleteWarehouseAction,
} from "@/app/admin/actions";
import { getCurrentAppUser } from "@/lib/auth/access";
import { getCatalogData, type CatalogSearchParams } from "@/lib/catalog/queries";
import { getOperationsData } from "@/lib/operations/queries";
import { getPartnersData, type PartnerRow } from "@/lib/partners/queries";
import { getStaffData, type StaffRow } from "@/lib/staff/queries";
import {
  getCatalogAdminData,
  type BrandRow,
  type ModelRow,
  type TypeRow,
  type FitmentRow,
  type WarehouseRow,
} from "@/lib/admin/queries";
import { getDocumentsData, type DocumentRow } from "@/lib/documents/queries";
import { getReportsData, type ReportsData } from "@/lib/reports/queries";
import {
  getSection,
  groupForSection,
  navigationGroups,
  resolveSection,
  sectionLabel,
  type WorkspaceSectionId,
} from "@/lib/operations/workspace";
import { canManageStaff, canWriteCatalog } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<CatalogSearchParams>;
};

type CatalogData = Awaited<ReturnType<typeof getCatalogData>>;
type CatalogProduct = CatalogData["products"][number];
type OperationsData = Awaited<ReturnType<typeof getOperationsData>>;
type PartnersData = Awaited<ReturnType<typeof getPartnersData>>;
type StaffData = Awaited<ReturnType<typeof getStaffData>>;
type CatalogAdminData = Awaited<ReturnType<typeof getCatalogAdminData>>;
type DocumentsData = Awaited<ReturnType<typeof getDocumentsData>>;

const OPERATIONS_SECTIONS = new Set<WorkspaceSectionId>([
  "receptii",
  "transferuri",
  "vanzari",
  "de-adus",
]);

const CATALOG_ADMIN_SECTIONS = new Set<WorkspaceSectionId>([
  "branduri",
  "modele",
  "tipuri",
  "compatibilitati",
  "depozite",
]);

export default async function Home({ searchParams }: HomeProps) {
  const appUser = await getCurrentAppUser();

  if (!appUser) {
    redirect("/auth/sign-in");
  }

  const params = await searchParams;
  const activeSectionId = resolveSection(params.section);
  const canManageStaffSection = canManageStaff(appUser.role);

  // Personal is ADMIN-only: send everyone else back to the catalog.
  if (activeSectionId === "personal" && !canManageStaffSection) {
    redirect("/");
  }

  const activeSection = getSection(activeSectionId);
  const canModify = canWriteCatalog(appUser.role);
  const catalogPromise =
    activeSectionId === "produse" ? getCatalogData(params) : null;
  const operationsPromise = OPERATIONS_SECTIONS.has(activeSectionId)
    ? getOperationsData()
    : null;
  const partnersPromise =
    activeSectionId === "furnizori" ? getPartnersData() : null;
  const staffPromise = activeSectionId === "personal" ? getStaffData() : null;
  const catalogAdminPromise = CATALOG_ADMIN_SECTIONS.has(activeSectionId)
    ? getCatalogAdminData()
    : null;
  const documentsPromise =
    activeSectionId === "documente" ? getDocumentsData() : null;
  const reportsPromise =
    activeSectionId === "rapoarte" ? getReportsData() : null;
  const workspaceKey = [
    activeSectionId,
    params.q,
    params.brand,
    params.model,
    params.type,
    params.year,
    params.page,
  ].join(":");

  return (
    <main className="min-h-[100dvh] bg-[#f4f2ec] lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="sticky top-0 z-40 border-b border-[#303a34] bg-[#18211d] text-white shadow-sm lg:fixed lg:inset-y-0 lg:left-0 lg:w-[13rem] lg:border-b-0 lg:border-r lg:shadow-none">
        <Sidebar
          activeSectionId={activeSectionId}
          role={appUser.role}
          userName={appUser.name}
          userEmail={appUser.email}
        />
      </aside>

      <section className="min-w-0 lg:col-start-2">
        <header className="motion-page border-b border-[#d8d2c6] bg-white px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1d2521]">
                {activeSection.title}
              </h1>
              <p className="mt-1 text-sm text-[#68746d]">{activeSection.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeSectionId === "produse" ? (
                <ExportLink href="/api/export/products" label="Export Excel" />
              ) : null}
              {canModify && catalogPromise ? (
                <Suspense fallback={<ButtonSkeleton />}>
                  <ProductHeaderAction catalogPromise={catalogPromise} />
                </Suspense>
              ) : null}
              {canModify && activeSectionId === "furnizori" ? (
                <PartnerFormDialog triggerLabel="Adaugă furnizor" />
              ) : null}
              {canModify && catalogAdminPromise ? (
                <Suspense fallback={<ButtonSkeleton />}>
                  <CatalogAdminHeaderAction
                    section={activeSectionId}
                    dataPromise={catalogAdminPromise}
                  />
                </Suspense>
              ) : null}
            </div>
          </div>
        </header>

        <SectionTabs activeSectionId={activeSectionId} />

        <Suspense
          key={workspaceKey}
          fallback={<WorkspaceSkeleton activeSectionId={activeSectionId} />}
        >
          <WorkspaceLoader
            activeSectionId={activeSectionId}
            canModify={canModify}
            currentUserId={appUser.id}
            catalogPromise={catalogPromise}
            operationsPromise={operationsPromise}
            partnersPromise={partnersPromise}
            staffPromise={staffPromise}
            catalogAdminPromise={catalogAdminPromise}
            documentsPromise={documentsPromise}
            reportsPromise={reportsPromise}
          />
        </Suspense>
      </section>
    </main>
  );
}

function Sidebar({
  activeSectionId,
  role,
  userName,
  userEmail,
}: {
  activeSectionId: WorkspaceSectionId;
  role: AppRole;
  userName: string | null;
  userEmail: string | null;
}) {
  const visibleGroups = navigationGroups.filter(
    (group) => !group.adminOnly || canManageStaff(role),
  );
  const userLabel = userName || userEmail || "Utilizator";

  return (
    <nav className="flex flex-col gap-2 px-3 py-2 lg:min-h-screen lg:gap-0 lg:px-3 lg:py-4">
      <div className="flex items-center justify-between gap-3 border-b border-[#303a34] px-1 pb-2 lg:block lg:px-2 lg:pb-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold lg:text-lg">Nadin Auto</p>
          <p className="mt-1 hidden text-xs font-medium text-[#99a49d] sm:block lg:block">Depozit și produse</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <div className="rounded-full border border-[#303a34] bg-[#202d27] px-2.5 py-1 text-[11px] font-semibold text-[#c9d1ca]">
            {role}
          </div>
          <LogoutButton compact />
        </div>
      </div>

      <div className="mobile-nav-scroll -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 lg:mx-0 lg:grid lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-4">
        {visibleGroups.map((group) => {
          const Icon = menuIcons[group.icon];
          const active = group.sections.includes(activeSectionId);

          return (
            <Link
              key={group.id}
              className={`motion-nav-link flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-sm lg:min-w-0 lg:gap-3 lg:rounded-lg lg:py-3 ${
                active
                  ? "bg-[#c6a635] text-[#18211d]"
                  : "text-[#c9d1ca] hover:bg-[#202d27] hover:text-white"
              }`}
              href={sectionHref(group.sections[0])}
            >
              <Icon className="size-4 shrink-0 lg:size-5" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block whitespace-nowrap font-semibold leading-none lg:leading-normal">{group.label}</span>
                <span className={`hidden truncate text-xs lg:block ${active ? "text-[#39433d]" : "text-[#99a49d]"}`}>
                  {group.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto hidden border-t border-[#303a34] px-2 pt-4 lg:block">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{userLabel}</p>
          <p className="mt-1 text-xs text-[#99a49d]">
            Rol: <span className="font-semibold text-[#c9d1ca]">{role}</span>
          </p>
        </div>
        <LogoutButton />
      </div>
    </nav>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        aria-label="Ieșire din cont"
        title="Ieșire din cont"
        className={`button-secondary inline-flex items-center justify-center rounded-md border border-[#303a34] bg-[#202d27] text-sm font-semibold text-[#c9d1ca] hover:bg-[#2b3a32] hover:text-white ${
          compact ? "size-8" : "mt-3 w-full gap-2 px-3 py-2"
        }`}
      >
        <LogOut className="size-4" aria-hidden="true" />
        {compact ? null : <span>Ieșire</span>}
      </button>
    </form>
  );
}

function SectionTabs({ activeSectionId }: { activeSectionId: WorkspaceSectionId }) {
  const group = groupForSection(activeSectionId);
  if (!group || group.sections.length <= 1) return null;

  return (
    <div className="border-b border-[#d8d2c6] bg-white px-4 lg:px-6">
      <div className="flex gap-1 overflow-x-auto">
        {group.sections.map((section) => {
          const active = section === activeSectionId;
          return (
            <Link
              key={section}
              href={sectionHref(section)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-[#c6a635] text-[#1d2521]"
                  : "border-transparent text-[#68746d] hover:text-[#1d2521]"
              }`}
            >
              {sectionLabel(section)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#d8d2c6] bg-white px-4 py-2.5 text-sm font-semibold text-[#1d2521] hover:bg-[#f4f2ec]"
    >
      <Download className="size-4" aria-hidden="true" />
      {label}
    </a>
  );
}

const menuIcons: Record<string, LucideIcon> = {
  ArrowRightLeft,
  BarChart3,
  CalendarRange,
  Car,
  ClipboardList,
  Download,
  FileText,
  Handshake,
  Layers,
  PackagePlus,
  PackageSearch,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
};

function CatalogAdminHeaderAction({
  section,
  dataPromise,
}: {
  section: WorkspaceSectionId;
  dataPromise: Promise<CatalogAdminData>;
}) {
  return (
    <Suspense fallback={<ButtonSkeleton />}>
      <CatalogAdminHeaderButton section={section} dataPromise={dataPromise} />
    </Suspense>
  );
}

async function CatalogAdminHeaderButton({
  section,
  dataPromise,
}: {
  section: WorkspaceSectionId;
  dataPromise: Promise<CatalogAdminData>;
}) {
  const data = await dataPromise;
  if (section === "branduri") return <BrandDialog triggerLabel="Adaugă brand" />;
  if (section === "tipuri") return <TypeDialog triggerLabel="Adaugă tip" />;
  if (section === "depozite") return <WarehouseDialog triggerLabel="Adaugă depozit" />;
  if (section === "modele")
    return <ModelDialog brands={data.brands.map((b) => ({ id: b.id, name: b.name }))} triggerLabel="Adaugă model" />;
  if (section === "compatibilitati")
    return <FitmentDialog models={fitmentModelOptions(data.models)} triggerLabel="Adaugă compatibilitate" />;
  return null;
}

function fitmentModelOptions(models: ModelRow[]) {
  return models.map((m) => ({ id: m.id, label: `${m.brand.name} ${m.name}` }));
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
      triggerLabel="Adaugă produs"
    />
  );
}

async function WorkspaceLoader({
  activeSectionId,
  canModify,
  currentUserId,
  catalogPromise,
  operationsPromise,
  partnersPromise,
  staffPromise,
  catalogAdminPromise,
  documentsPromise,
  reportsPromise,
}: {
  activeSectionId: WorkspaceSectionId;
  canModify: boolean;
  currentUserId: string;
  catalogPromise: Promise<CatalogData> | null;
  operationsPromise: Promise<OperationsData> | null;
  partnersPromise: Promise<PartnersData> | null;
  staffPromise: Promise<StaffData> | null;
  catalogAdminPromise: Promise<CatalogAdminData> | null;
  documentsPromise: Promise<DocumentsData> | null;
  reportsPromise: Promise<ReportsData> | null;
}) {
  if (activeSectionId === "produse") {
    if (!catalogPromise) return null;
    const catalog = await catalogPromise;
    return <ProductWorkspace canModify={canModify} catalog={catalog} />;
  }

  if (activeSectionId === "furnizori") {
    if (!partnersPromise) return null;
    const data = await partnersPromise;
    return <PartnersWorkspace canModify={canModify} partners={data.partners} />;
  }

  if (activeSectionId === "personal") {
    if (!staffPromise) return null;
    const data = await staffPromise;
    return <StaffWorkspace users={data.users} currentUserId={currentUserId} />;
  }

  if (catalogAdminPromise) {
    const data = await catalogAdminPromise;
    return <CatalogAdminWorkspace section={activeSectionId} canModify={canModify} data={data} />;
  }

  if (activeSectionId === "documente") {
    if (!documentsPromise) return null;
    const data = await documentsPromise;
    return <DocumentsWorkspace documents={data.documents} canModify={canModify} />;
  }

  if (activeSectionId === "rapoarte") {
    if (!reportsPromise) return null;
    const data = await reportsPromise;
    return <ReportsWorkspace data={data} />;
  }

  if (!operationsPromise) return null;
  const operations = await operationsPromise;

  if (activeSectionId === "vanzari") {
    return <SalesWorkspace canModify={canModify} operations={operations} />;
  }

  if (activeSectionId === "de-adus") {
    return <RestockWorkspace canModify={canModify} operations={operations} />;
  }

  return (
    <StockWorkspace
      activeSectionId={activeSectionId}
      canModify={canModify}
      operations={operations}
    />
  );
}

function ButtonSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="skeleton-pulse h-10 w-32 rounded-md bg-[#e7e2d8]"
    />
  );
}

function WorkspaceSkeleton({
  activeSectionId,
}: {
  activeSectionId: WorkspaceSectionId;
}) {
  const isSales = activeSectionId === "vanzari";
  const isProducts = activeSectionId === "produse";

  return (
    <section
      aria-label="Se încarcă datele"
      aria-live="polite"
      className="grid gap-4 p-4 lg:p-5"
    >
      {isSales ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : null}

      {isProducts ? (
        <div className="grid gap-3 rounded-lg border border-[#d8d2c6] bg-[#f8f6f1] p-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="skeleton-pulse h-11 rounded-md bg-[#e7e2d8]"
            />
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
        <div className="h-12 bg-[#202d27]" />
        <div className="grid gap-3 p-4">
          {Array.from({ length: isProducts ? 8 : 5 }, (_, index) => (
            <div
              key={index}
              className="skeleton-pulse h-11 rounded-md bg-[#eeeae1]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#d8d2c6] bg-white p-4">
      <div className="skeleton-pulse h-4 w-24 rounded bg-[#e7e2d8]" />
      <div className="skeleton-pulse mt-3 h-8 w-16 rounded bg-[#eeeae1]" />
    </div>
  );
}

function SalesWorkspace({
  canModify,
  operations,
}: {
  canModify: boolean;
  operations: OperationsData;
}) {
  const totalProducts = operations.salesToday.reduce(
    (total, document) =>
      total + document.lines.reduce((lineTotal, line) => lineTotal + line.quantity, 0),
    0,
  );
  const totalLei = operations.salesToday.reduce(
    (total, document) => total + Number(document.totalLei ?? document.totalEuro ?? 0),
    0,
  );

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <DailyMetric label="Vânzări azi" value={formatNumber(operations.salesToday.length)} />
        <DailyMetric label="Produse vândute" value={formatNumber(totalProducts)} />
        <DailyMetric label="Total azi" value={`${formatMoney(totalLei)} lei`} />
      </div>
      {canModify ? (
        <div className="flex justify-end">
          <StockSaleDialog warehouses={toWarehouseOptions(operations.warehouses)} />
        </div>
      ) : null}
      <RecentDocumentsTable documents={operations.salesToday} canModify={canModify} />
    </section>
  );
}

function RestockWorkspace({
  canModify,
  operations,
}: {
  canModify: boolean;
  operations: OperationsData;
}) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="motion-card flex flex-col gap-3 rounded-lg border border-[#d8d2c6] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#1d2521]">Reaprovizionare Pavilion 110A</h2>
          <p className="text-sm text-[#68746d]">
            Lista conține exact cantitățile vândute azi din Pavilion 110A.
          </p>
        </div>
        {canModify ? (
          <StockTransferDialog warehouses={toWarehouseOptions(operations.warehouses)} />
        ) : null}
      </div>
      <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-[#202d27] text-white">
              <tr>
                <TableHead>Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Vândut azi</TableHead>
                <TableHead align="right">De adus în 110A</TableHead>
              </tr>
            </thead>
            <tbody>
              {operations.soldToday.length > 0 ? (
                operations.soldToday.map((line) => (
                  <tr key={line.productId} className="motion-table-row border-t border-[#e7e2d8] odd:bg-white even:bg-[#fbfaf7] hover:bg-[#f4f2ec]">
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatText(line.product.externalCode)}
                    </TableCell>
                    <TableCell className="font-medium">{line.product.description}</TableCell>
                    <TableCell align="right" className="font-mono">{formatNumber(line.quantity)}</TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{formatNumber(line.quantity)}</TableCell>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#68746d]" colSpan={4}>
                    Nu sunt produse vândute azi din Pavilion 110A.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DailyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="motion-card rounded-lg border border-[#d8d2c6] bg-white p-4">
      <p className="text-sm font-medium text-[#68746d]">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-[#1d2521]">{value}</p>
    </div>
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
          <p className="text-sm text-[#68746d]">
            {start}-{end} din {formatNumber(catalog.productCount)} produse
          </p>
          <Link
            className="text-sm font-medium text-[#1d2521] underline decoration-[#c6a635] underline-offset-4"
            href={sectionHref("produse")}
          >
            Resetează filtrele
          </Link>
        </div>

        <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="bg-[#202d27] text-white">
                <tr>
                  <TableHead>Cod</TableHead>
                  <TableHead>Compatibilitate</TableHead>
                  <TableHead>Produs</TableHead>
                  <TableHead align="right">Stoc</TableHead>
                  <TableHead align="right">Preț vânzare</TableHead>
                  {canModify ? <TableHead align="right">Cost aducere</TableHead> : null}
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
            <div className="px-4 py-12 text-center text-sm text-[#68746d]">
              Nu sunt produse pentru filtrele curente.
            </div>
          ) : null}
        </div>

        {catalog.productCount > pageSize ? (
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <p className="text-[#68746d]">
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
  const model = product.fitment.carModel;

  return (
    <tr className="motion-table-row border-t border-[#e7e2d8] align-top odd:bg-white even:bg-[#fbfaf7] hover:bg-[#f4f2ec]">
      <TableCell className="font-mono text-xs font-semibold">{formatText(product.externalCode)}</TableCell>
      <TableCell>
        <p className="font-semibold text-[#1d2521]">{model.brand.name} {model.name}</p>
        <p className="mt-1 text-xs text-[#68746d]">
          Ani: {formatYearLabel(product.fitment.yearStart, product.fitment.yearEnd, product.fitment.yearOpenEnded)}
        </p>
      </TableCell>
      <TableCell>
        <p className="font-medium text-[#1d2521]">{product.description}</p>
        <p className="mt-1 text-xs text-[#68746d]">{product.type.name}</p>
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">{formatNumber(product.stock)}</TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">
        {product.salePriceLei != null ? `${formatMoney(product.salePriceLei)} lei` : "—"}
      </TableCell>
      {canModify ? (
        <TableCell align="right" className="tabular-nums text-[#68746d]">
          <p>{formatMoney(product.costLei)} lei</p>
          <p className="mt-1 text-xs">{formatMoney(product.priceEuro)} EUR</p>
        </TableCell>
      ) : null}
      {canModify ? (
        <TableCell align="right">
          <div className="flex justify-end gap-2">
            <ProductFormDialog
              brands={catalog.brands}
              models={catalog.models}
              product={toProductFormValue(product)}
              triggerKind="row"
              triggerLabel="Editează"
              types={catalog.types}
            />
            <ProductDeleteButton productId={product.id} label={product.description} />
          </div>
        </TableCell>
      ) : null}
    </tr>
  );
}

function StockWorkspace({
  activeSectionId,
  canModify,
  operations,
}: {
  activeSectionId: WorkspaceSectionId;
  canModify: boolean;
  operations: OperationsData;
}) {
  const warehouses = toWarehouseOptions(operations.warehouses);
  const documents = operations.recentDocuments.filter((document) =>
    activeSectionId === "receptii" ? document.type === "RECEIPT" : document.type === "ADJUSTMENT",
  );

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      {canModify ? (
        <div className="flex justify-end">
          {activeSectionId === "receptii" ? (
            <StockDocumentDialog warehouses={warehouses} />
          ) : (
            <StockTransferDialog warehouses={warehouses} />
          )}
        </div>
      ) : null}
      <RecentDocumentsTable documents={documents} canModify={canModify} />
    </section>
  );
}

function documentTotalLei(doc: {
  totalLei: { toString(): string } | null;
  totalEuro: { toString(): string } | null;
  lines: { quantity: number; unitCostLei: { toString(): string } | null; unitPriceEuro: { toString(): string } | null }[];
}): number {
  if (doc.totalLei != null) return Number(doc.totalLei);
  if (doc.totalEuro != null) return Number(doc.totalEuro);
  return doc.lines.reduce(
    (sum, l) => sum + l.quantity * Number(l.unitCostLei ?? l.unitPriceEuro ?? 0),
    0,
  );
}

function toDocLines(doc: {
  type: string;
  lines: {
    productId: string;
    quantity: number;
    unitPriceEuro: { toString(): string } | null;
    unitCostLei: { toString(): string } | null;
    product: { description: string; externalCode: string | null };
  }[];
}) {
  const isSale = doc.type === "SALE";
  return doc.lines.map((l) => {
    const price = isSale ? l.unitPriceEuro : l.unitCostLei;
    return {
      productId: l.productId,
      label: `${l.product.externalCode ? `${l.product.externalCode} · ` : ""}${l.product.description}`,
      quantity: String(l.quantity),
      price: price != null ? String(price) : "",
    };
  });
}

function RecentDocumentsTable({
  documents,
  canModify = false,
}: {
  documents: OperationsData["recentDocuments"];
  canModify?: boolean;
}) {
  return (
    <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-[#202d27] text-white">
            <tr>
              <TableHead>Data</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Depozit</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead align="right">Cantitate</TableHead>
              <TableHead align="right">Total</TableHead>
              <TableHead align="right">TVA (÷6)</TableHead>
              {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
            </tr>
          </thead>
          <tbody>
            {documents.length > 0 ? documents.map((document) => {
              const docTotal = documentTotalLei(document);
              return (
              <tr key={document.id} className="motion-table-row border-t border-[#e7e2d8] odd:bg-white even:bg-[#fbfaf7] hover:bg-[#f4f2ec]">
                <TableCell>{formatDate(document.documentDate)}</TableCell>
                <TableCell className="font-semibold">{formatDocumentType(document.type)} #{document.number}</TableCell>
                <TableCell>{document.warehouse.name}</TableCell>
                <TableCell>{document.lines.map((line) => line.product.description).join(", ")}</TableCell>
                <TableCell align="right" className="font-mono">
                  {formatNumber(document.lines.reduce((sum, line) => sum + line.quantity, 0))}
                </TableCell>
                <TableCell align="right" className="font-mono font-semibold">{formatMoney(docTotal)} lei</TableCell>
                <TableCell align="right" className="font-mono text-[#68746d]">{formatMoney(docTotal / 6)} lei</TableCell>
                {canModify ? (
                  <TableCell align="right">
                    <DocumentRowActions
                      id={document.id}
                      title={`${formatDocumentType(document.type)} #${document.number}`}
                      documentDate={document.documentDate.toISOString().slice(0, 10)}
                      notes={document.notes ?? ""}
                      partnerName={document.partner?.name ?? ""}
                      lines={toDocLines(document)}
                    />
                  </TableCell>
                ) : null}
              </tr>
              );
            }) : (
              <tr>
                <td className="px-3 py-10 text-center text-[#68746d]" colSpan={canModify ? 8 : 7}>
                  Nu există documente încă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const adminRowCls =
  "motion-table-row border-t border-[#e7e2d8] align-top odd:bg-white even:bg-[#fbfaf7] hover:bg-[#f4f2ec]";

function AdminSection({
  head,
  children,
  empty,
  isEmpty,
  minWidth = "640px",
}: {
  head: (string | null)[];
  children: ReactNode;
  empty: string;
  isEmpty: boolean;
  minWidth?: string;
}) {
  return (
    <section className="motion-page p-4 lg:p-5">
      <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
            <thead className="bg-[#202d27] text-white">
              <tr>
                {head.map((h, i) =>
                  h === null ? null : (
                    <TableHead key={i} align={i === head.length - 1 && h === "Acțiuni" ? "right" : "left"}>
                      {h}
                    </TableHead>
                  ),
                )}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
        {isEmpty ? <div className="px-4 py-12 text-center text-sm text-[#68746d]">{empty}</div> : null}
      </div>
    </section>
  );
}

function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}

function CatalogAdminWorkspace({
  section,
  canModify,
  data,
}: {
  section: WorkspaceSectionId;
  canModify: boolean;
  data: CatalogAdminData;
}) {
  if (section === "branduri") {
    return (
      <AdminSection head={["Brand", "Modele", canModify ? "Acțiuni" : null]} empty="Niciun brand." isEmpty={data.brands.length === 0}>
        {data.brands.map((b: BrandRow) => (
          <tr key={b.id} className={adminRowCls}>
            <TableCell className="font-semibold text-[#1d2521]">{b.name}</TableCell>
            <TableCell align="right" className="font-mono">{formatNumber(b._count.models)}</TableCell>
            {canModify ? (
              <TableCell align="right">
                <RowActions>
                  <BrandDialog entity={{ id: b.id, name: b.name }} triggerKind="row" triggerLabel="Editează" />
                  <AdminDeleteButton action={deleteBrandAction} id={b.id} confirmLabel={`brandul „${b.name}”`} />
                </RowActions>
              </TableCell>
            ) : null}
          </tr>
        ))}
      </AdminSection>
    );
  }

  if (section === "tipuri") {
    return (
      <AdminSection head={["Tip produs", "Produse", canModify ? "Acțiuni" : null]} empty="Niciun tip." isEmpty={data.types.length === 0}>
        {data.types.map((t: TypeRow) => (
          <tr key={t.id} className={adminRowCls}>
            <TableCell className="font-semibold text-[#1d2521]">{t.name}</TableCell>
            <TableCell align="right" className="font-mono">{formatNumber(t._count.products)}</TableCell>
            {canModify ? (
              <TableCell align="right">
                <RowActions>
                  <TypeDialog entity={{ id: t.id, name: t.name }} triggerKind="row" triggerLabel="Editează" />
                  <AdminDeleteButton action={deleteTypeAction} id={t.id} confirmLabel={`tipul „${t.name}”`} />
                </RowActions>
              </TableCell>
            ) : null}
          </tr>
        ))}
      </AdminSection>
    );
  }

  if (section === "modele") {
    const brands = data.brands.map((b) => ({ id: b.id, name: b.name }));
    return (
      <AdminSection head={["Model", "Brand", "Compatibilități", canModify ? "Acțiuni" : null]} empty="Niciun model." isEmpty={data.models.length === 0}>
        {data.models.map((m: ModelRow) => (
          <tr key={m.id} className={adminRowCls}>
            <TableCell className="font-semibold text-[#1d2521]">{m.name}</TableCell>
            <TableCell>{m.brand.name}</TableCell>
            <TableCell align="right" className="font-mono">{formatNumber(m._count.fitments)}</TableCell>
            {canModify ? (
              <TableCell align="right">
                <RowActions>
                  <ModelDialog brands={brands} model={{ id: m.id, name: m.name, brandId: m.brandId }} triggerKind="row" triggerLabel="Editează" />
                  <AdminDeleteButton action={deleteModelAction} id={m.id} confirmLabel={`modelul „${m.brand.name} ${m.name}”`} />
                </RowActions>
              </TableCell>
            ) : null}
          </tr>
        ))}
      </AdminSection>
    );
  }

  if (section === "compatibilitati") {
    const models = fitmentModelOptions(data.models);
    return (
      <AdminSection head={["Compatibilitate", "Model", "Ani", "Produse", canModify ? "Acțiuni" : null]} empty="Nicio compatibilitate." isEmpty={data.fitments.length === 0} minWidth="820px">
        {data.fitments.map((f: FitmentRow) => (
          <tr key={f.id} className={adminRowCls}>
            <TableCell className="font-semibold text-[#1d2521]">{f.label}</TableCell>
            <TableCell>{f.carModel.brand.name} {f.carModel.name}</TableCell>
            <TableCell>{formatYearLabel(f.yearStart, f.yearEnd, f.yearOpenEnded)}</TableCell>
            <TableCell align="right" className="font-mono">{formatNumber(f._count.products)}</TableCell>
            {canModify ? (
              <TableCell align="right">
                <RowActions>
                  <FitmentDialog
                    models={models}
                    fitment={{ id: f.id, carModelId: f.carModelId, label: f.label, yearStart: f.yearStart, yearEnd: f.yearEnd, yearOpenEnded: f.yearOpenEnded }}
                    triggerKind="row"
                    triggerLabel="Editează"
                  />
                  <AdminDeleteButton action={deleteFitmentAction} id={f.id} confirmLabel={`compatibilitatea „${f.label}”`} />
                </RowActions>
              </TableCell>
            ) : null}
          </tr>
        ))}
      </AdminSection>
    );
  }

  // depozite
  return (
    <AdminSection head={["Depozit", "Implicit", "Activ", "Produse în stoc", canModify ? "Acțiuni" : null]} empty="Niciun depozit." isEmpty={data.warehouses.length === 0}>
      {data.warehouses.map((w: WarehouseRow) => (
        <tr key={w.id} className={adminRowCls}>
          <TableCell className="font-semibold text-[#1d2521]">{w.name}</TableCell>
          <TableCell>{w.isDefault ? "Da" : "—"}</TableCell>
          <TableCell>{w.active ? "Da" : "Inactiv"}</TableCell>
          <TableCell align="right" className="font-mono">{formatNumber(w._count.stocks)}</TableCell>
          {canModify ? (
            <TableCell align="right">
              <RowActions>
                <WarehouseDialog warehouse={{ id: w.id, name: w.name, isDefault: w.isDefault, active: w.active }} triggerKind="row" triggerLabel="Editează" />
                <AdminDeleteButton action={deleteWarehouseAction} id={w.id} confirmLabel={`depozitul „${w.name}”`} />
              </RowActions>
            </TableCell>
          ) : null}
        </tr>
      ))}
    </AdminSection>
  );
}

function DocumentsWorkspace({ documents, canModify }: { documents: DocumentRow[]; canModify: boolean }) {
  return (
    <section className="motion-page p-4 lg:p-5">
      <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" style={{ minWidth: "900px" }}>
            <thead className="bg-[#202d27] text-white">
              <tr>
                <TableHead>Data</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Depozit</TableHead>
                <TableHead>Partener</TableHead>
                <TableHead align="right">Produse</TableHead>
                <TableHead align="right">Total</TableHead>
                <TableHead align="right">Factură</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className={adminRowCls}>
                  <TableCell>{formatDate(d.documentDate)}</TableCell>
                  <TableCell className="font-semibold">{formatDocType(d.type)} #{d.number}</TableCell>
                  <TableCell>{d.warehouse.name}</TableCell>
                  <TableCell>{d.partner?.name ?? "—"}</TableCell>
                  <TableCell align="right" className="font-mono">{formatNumber(d._count.lines)}</TableCell>
                  <TableCell align="right" className="font-mono">
                    {d.totalEuro != null ? `${formatMoney(d.totalEuro)} EUR` : d.totalLei != null ? `${formatMoney(d.totalLei)} lei` : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <a
                      href={`/api/export/invoice/${d.id}`}
                      className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#d8d2c6] px-3 py-1.5 text-xs font-semibold text-[#1d2521] hover:bg-[#f4f2ec]"
                    >
                      <Download className="size-3.5" aria-hidden="true" /> Factură
                    </a>
                  </TableCell>
                  {canModify ? (
                    <TableCell align="right">
                      <DocumentRowActions
                        id={d.id}
                        title={`${formatDocType(d.type)} #${d.number}`}
                        documentDate={d.documentDate.toISOString().slice(0, 10)}
                        notes={d.notes ?? ""}
                        partnerName={d.partner?.name ?? ""}
                        lines={toDocLines(d)}
                      />
                    </TableCell>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {documents.length === 0 ? <div className="px-4 py-12 text-center text-sm text-[#68746d]">Niciun document încă.</div> : null}
      </div>
    </section>
  );
}

function ReportsWorkspace({ data }: { data: ReportsData }) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DailyMetric label="Produse" value={formatNumber(data.totalProducts)} />
        <DailyMetric label="Stoc total (buc.)" value={formatNumber(data.totalStock)} />
        <DailyMetric label="Valoare stoc" value={`${formatMoney(data.valueEur)} EUR`} />
        <DailyMetric label="Vânzări 30 zile" value={`${formatNumber(data.sales30Count)} / ${formatMoney(data.sales30Eur)} EUR`} />
      </div>

      <CurrencyWidget valueLei={data.stockValueLei} rates={data.rates} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
          <div className="border-b border-[#e7e2d8] px-4 py-3 font-semibold text-[#1d2521]">Stoc pe depozit</div>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {data.warehouseStock.map((w) => (
                <tr key={w.id} className={adminRowCls}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell align="right" className="font-mono font-semibold">{formatNumber(w.total_quantity)}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
          <div className="border-b border-[#e7e2d8] px-4 py-3 font-semibold text-[#1d2521]">Produse sub stoc minim (≤3)</div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-left text-sm">
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.id} className={adminRowCls}>
                    <TableCell className="font-mono text-xs">{formatText(p.code)}</TableCell>
                    <TableCell>{p.description}</TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{p.stock ?? 0}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatDocType(type: string) {
  if (type === "RECEIPT") return "Recepție";
  if (type === "SALE") return "Vânzare";
  if (type === "RETURN") return "Retur";
  return "Ajustare/Transfer";
}

function PartnersWorkspace({
  canModify,
  partners,
}: {
  canModify: boolean;
  partners: PartnerRow[];
}) {
  return (
    <section className="motion-page p-4 lg:p-5">
      <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-[#202d27] text-white">
              <tr>
                <TableHead>Nume</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Note</TableHead>
                <TableHead align="right">Documente</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr
                  key={partner.id}
                  className="motion-table-row border-t border-[#e7e2d8] align-top odd:bg-white even:bg-[#fbfaf7] hover:bg-[#f4f2ec]"
                >
                  <TableCell className="font-semibold text-[#1d2521]">
                    {partner.name}
                  </TableCell>
                  <TableCell>{formatPartnerKind(partner.kind)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatText(partner.phone)}
                  </TableCell>
                  <TableCell className="max-w-xs text-[#68746d]">
                    {formatText(partner.notes)}
                  </TableCell>
                  <TableCell align="right" className="font-mono">
                    {formatNumber(partner._count.documents)}
                  </TableCell>
                  {canModify ? (
                    <TableCell align="right">
                      <div className="flex justify-end gap-2">
                        <PartnerFormDialog
                          partner={toPartnerFormValue(partner)}
                          triggerKind="row"
                          triggerLabel="Editează"
                        />
                        <PartnerDeleteButton
                          partnerId={partner.id}
                          partnerName={partner.name}
                        />
                      </div>
                    </TableCell>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {partners.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#68746d]">
            Nu există furnizori încă.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StaffWorkspace({
  users,
  currentUserId,
}: {
  users: StaffRow[];
  currentUserId: string;
}) {
  return (
    <section className="motion-page p-4 lg:p-5">
      <div className="motion-card overflow-hidden rounded-lg border border-[#d8d2c6] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-[#202d27] text-white">
              <tr>
                <TableHead>Nume</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol curent</TableHead>
                <TableHead align="right">Acțiuni</TableHead>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="motion-table-row border-t border-[#e7e2d8] align-middle odd:bg-white even:bg-[#fbfaf7] hover:bg-[#f4f2ec]"
                >
                  <TableCell className="font-semibold text-[#1d2521]">
                    {formatText(user.name)}
                  </TableCell>
                  <TableCell className="text-[#68746d]">
                    {formatText(user.email)}
                  </TableCell>
                  <TableCell>{formatRole(user.role)}</TableCell>
                  <TableCell align="right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <RoleForm userId={user.id} currentRole={user.role} />
                      {user.id !== currentUserId ? (
                        <StaffDeleteButton
                          userId={user.id}
                          label={user.name ?? user.email ?? user.id}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#68746d]">
            Niciun utilizator încă.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function toPartnerFormValue(partner: PartnerRow): PartnerFormValue {
  return {
    id: partner.id,
    name: partner.name,
    kind: partner.kind,
    phone: partner.phone ?? "",
    notes: partner.notes ?? "",
  };
}

function formatPartnerKind(kind: PartnerRow["kind"]) {
  if (kind === "SUPPLIER") return "Furnizor";
  if (kind === "CUSTOMER") return "Client";
  return "Furnizor și client";
}

function formatRole(role: AppRole) {
  if (role === "ADMIN") return "Administrator";
  if (role === "DIRECTOR") return "Director";
  return "Angajat";
}

function TableHead({
  align = "left",
  children,
}: {
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <th
      className={`border-r border-[#35413a] px-3 py-3 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TableCell({
  align = "left",
  children,
  className = "",
}: {
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`border-r border-[#e7e2d8] px-3 py-3 ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
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
    return <span className="rounded-md border border-[#ddd8ce] bg-[#eeeae1] px-3 py-2 text-[#8a918d]">{label}</span>;
  }

  return (
    <Link className="button-secondary rounded-md border border-[#d8d2c6] bg-white px-3 py-2 font-medium hover:bg-[#f4f2ec]" href={catalogPageHref(catalog.params, page)}>
      {label}
    </Link>
  );
}

function sectionHref(section: WorkspaceSectionId) {
  return `/?section=${section}`;
}

function catalogPageHref(params: CatalogData["params"], page: number) {
  const next = new URLSearchParams({ section: "produse" });

  for (const key of ["q", "brand", "model", "type", "year"] as const) {
    const value = params[key];
    if (value) next.set(key, value);
  }

  if (page > 1) next.set("page", String(page));
  return `/?${next.toString()}`;
}

function toWarehouseOptions(warehouses: OperationsData["warehouses"]): WarehouseOption[] {
  return warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name }));
}

function formatDocumentType(type: string) {
  if (type === "RECEIPT") return "Recepție";
  if (type === "SALE") return "Vânzare";
  return "Transfer";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ro-MD", { day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}

function formatYearLabel(yearStart: number | null, yearEnd: number | null, yearOpenEnded: boolean) {
  if (!yearStart && !yearEnd) return "-";
  if (yearOpenEnded) return `${yearStart}+`;
  return [yearStart, yearEnd].filter(Boolean).join("-");
}

function formatMoney(value: { toString(): string } | number | null) {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(numeric)
    : "-";
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined
    ? "-"
    : new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 0 }).format(value);
}

function formatText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function toProductFormValue(product: CatalogProduct): ProductFormValue {
  return {
    id: product.id,
    externalCode: product.externalCode ?? "",
    brandId: product.fitment.carModel.brand.id,
    modelId: product.fitment.carModel.id,
    typeId: product.type.id,
    description: product.description,
    yearStart: formatFormValue(product.fitment.yearStart),
    yearEnd: formatFormValue(product.fitment.yearEnd),
    yearOpenEnded: product.fitment.yearOpenEnded,
    stock: formatFormValue(product.stock),
    priceEuro: formatFormValue(product.priceEuro),
    costLei: formatFormValue(product.costLei),
    salePriceLei: formatFormValue(product.salePriceLei),
  };
}

function formatFormValue(value: { toString(): string } | number | null | undefined) {
  return value === null || value === undefined ? "" : value.toString();
}
