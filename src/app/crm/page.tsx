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
  Printer,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { LocalBadge } from "@/app/components/local-badge";
import { ChangePasswordDialog } from "@/app/account/change-password-dialog";
import { TrustedDeviceControl } from "@/app/account/trusted-device-control";
import { SidebarCollapseButton } from "./sidebar-collapse";
import { vehicleLabel, type VehicleFitmentInfo } from "@/lib/catalog/vehicle-label";
import { CatalogFilters } from "@/app/catalog/catalog-filters";
import {
  ProductFormDialog,
  type ProductFormValue,
} from "@/app/catalog/product-form-dialog";
import { ProductDeleteButton } from "@/app/catalog/product-delete-button";
import { LabelPicker } from "@/app/catalog/label-picker";
import { CurrencyWidget } from "@/app/rapoarte/currency-widget";
import {
  StockDocumentDialog,
  StockSaleDialog,
  StockTransferDialog,
  type SupplierOption,
  type WarehouseOption,
} from "@/app/operations/stock-document-dialog";
import {
  PartnerFormDialog,
  type PartnerFormValue,
} from "@/app/partners/partner-form-dialog";
import { PartnerDeleteButton } from "@/app/partners/partner-delete-button";
import { DocumentRowActions } from "@/app/operations/document-row-actions";
import {
  CashRegisterBadge,
  CashRegisterControl,
} from "@/app/operations/cash-register-control";
import {
  SalePaymentMethodBadge,
  SalePaymentMethodControl,
} from "@/app/operations/sale-payment-method-control";
import {
  DocumentDetailsButton,
  type DocumentDetailsValue,
} from "@/app/operations/document-details";
import { RestoreButton } from "@/app/istoric/restore-button";
import { ReturnDialog, type ReturnableSale } from "@/app/operations/return-dialog";
import { RestockCheckbox } from "@/app/operations/restock-checkbox";
import { RoleForm } from "@/app/staff/role-form";
import {
  CreateStaffDialog,
  IssueTwoFactorActivationDialog,
  ResetPasswordDialog,
  ResetTwoFactorDialog,
  StaffActiveButton,
} from "@/app/staff/staff-dialogs";
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
import { getAuthAccessState } from "@/lib/auth/two-factor/access-state";
import { getCatalogData, type CatalogSearchParams } from "@/lib/catalog/queries";
import { buildCompatibilityLines } from "@/lib/catalog/compatibility-display";
import {
  crmAuditHref,
  crmCatalogPageHref,
  crmDocumentsHref,
  crmSectionHref,
} from "@/lib/crm/urls";
import {
  getInventoryData,
  getOperationsData,
  getSalesDayData,
  type InventoryData,
  type SalesDayData,
} from "@/lib/operations/queries";
import { SalesDayNav } from "./sales-day-nav";
import { InventoryDialog } from "@/app/operations/inventory-dialog";
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
import { getDocumentsData } from "@/lib/documents/queries";
import { getReportsData, type ReportsData } from "@/lib/reports/queries";
import { getStatsData, type StatsData } from "@/lib/stats/queries";
import {
  getApprovalsData,
  getAuditData,
  getPendingApprovalCount,
  type ApprovalsData,
  type AuditData,
  type AuditRow,
} from "@/lib/audit/queries";
import { ApprovalWorkspace } from "@/app/aprobari/approval-workspace";
import { PaymentAccountsWorkspace } from "@/app/payment-accounts/payment-accounts-workspace";
import { getPaymentAccountsData } from "@/lib/payment-accounts/queries";
import { ExternalOrdersWorkspace } from "@/app/external-orders/external-orders-workspace";
import { getExternalOrdersData, type ExternalOrdersData } from "@/lib/external-orders/queries";
import { DailyChart, MonthlyChart, TopProductsChart } from "@/app/stats-charts";
import {
  getSection,
  groupForSection,
  navigationGroups,
  resolveSection,
  sectionLabel,
  type WorkspaceSectionId,
} from "@/lib/operations/workspace";
import { canCreateSales, canManageStaff, canReviewOperations, canViewSection, canWriteCatalog } from "@/lib/roles";
import { COMPANY } from "@/lib/company";
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
type PaymentAccountsData = Awaited<ReturnType<typeof getPaymentAccountsData>>;

const OPERATIONS_SECTIONS = new Set<WorkspaceSectionId>([
  "receptii",
  "transferuri",
  "vanzari",
  "retururi",
  "de-adus",
  "fara-stoc",
]);

const CATALOG_ADMIN_SECTIONS = new Set<WorkspaceSectionId>([
  "branduri",
  "modele",
  "tipuri",
  "compatibilitati",
  "depozite",
]);

export default async function Home({ searchParams }: HomeProps) {
  const authState = await getAuthAccessState();
  if (authState.kind === "UNAUTHENTICATED") redirect("/auth/sign-in");
  if (authState.kind !== "AUTHENTICATED") redirect("/auth/2fa/continue");
  const appUser = authState.primary.appUser;

  const params = await searchParams;
  const activeSectionId = resolveSection(params.section);

  // Vizibilitatea pe rol: ANGAJAT vede doar produse + vânzări, Personal e
  // doar pentru ADMIN, Istoric doar pentru ADMIN/DIRECTOR.
  if (!canViewSection(appUser.role, activeSectionId)) {
    redirect("/");
  }

  const activeSection = getSection(activeSectionId);
  const canModify = canWriteCatalog(appUser.role);
  const canSell = canCreateSales(appUser.role);
  const canBackup = canManageStaff(appUser.role);
  const catalogPromise =
    activeSectionId === "produse"
      ? getCatalogData(params, { onlyInStock: appUser.role === "ANGAJAT" })
      : null;
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
    activeSectionId === "documente"
      ? getDocumentsData({
          dtype: params.dtype,
          partner: params.partner,
          from: params.from,
          to: params.to,
          dpage: params.dpage,
        })
      : null;
  const paymentAccountsPromise =
    activeSectionId === "conturi-plata" ? getPaymentAccountsData() : null;
  const externalOrdersPromise =
    activeSectionId === "la-comanda" ? getExternalOrdersData() : null;
  const reportsPromise =
    activeSectionId === "rapoarte" ? getReportsData() : null;
  const statsPromise =
    activeSectionId === "statistici" ? getStatsData() : null;
  const inventoryPromise =
    activeSectionId === "inventar" ? getInventoryData(params.wh) : null;
  const auditPromise =
    activeSectionId === "istoric"
      ? getAuditData({ doc: params.doc, act: params.act })
      : null;
  const approvalsPromise =
    activeSectionId === "aprobari" ? getApprovalsData() : null;
  const salesDayPromise =
    activeSectionId === "vanzari" ? getSalesDayData(params.day) : null;
  // Contorul din meniu: câte operațiuni de angajați așteaptă aprobarea.
  const pendingApprovals = canReviewOperations(appUser.role)
    ? await getPendingApprovalCount()
    : 0;
  const workspaceKey = [
    activeSectionId,
    params.q,
    params.brand,
    params.model,
    params.type,
    params.year,
    params.page,
    params.wh,
    params.doc,
    params.act,
    params.dtype,
    params.partner,
    params.from,
    params.to,
    params.dpage,
    params.day,
  ].join(":");

  return (
    <main className="crm-main min-h-[100dvh] bg-[#f6f6f4] lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <aside className="crm-aside sticky top-0 z-40 border-b border-[#e8e7e3] bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-[13.5rem] lg:border-b-0 lg:border-r">
        <Sidebar
          activeSectionId={activeSectionId}
          role={appUser.role}
          userName={appUser.name}
          userEmail={appUser.email}
          pendingApprovals={pendingApprovals}
        />
      </aside>

      <section className="min-w-0 lg:col-start-2">
        <header className="motion-page border-b border-[#e8e7e3] bg-white px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-[#1b1a17]">
              {activeSection.title}
            </h1>
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
                <PartnerFormDialog triggerLabel="Adaugă partener" />
              ) : null}
              {activeSectionId === "personal" && canManageStaff(appUser.role) ? (
                <CreateStaffDialog />
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

        <SectionTabs
          activeSectionId={activeSectionId}
          role={appUser.role}
          pendingApprovals={pendingApprovals}
        />

        <Suspense
          key={workspaceKey}
          fallback={<WorkspaceSkeleton activeSectionId={activeSectionId} />}
        >
          <WorkspaceLoader
            activeSectionId={activeSectionId}
            canModify={canModify}
            canSell={canSell}
            canBackup={canBackup}
            currentUserId={appUser.id}
            catalogPromise={catalogPromise}
            operationsPromise={operationsPromise}
            partnersPromise={partnersPromise}
            staffPromise={staffPromise}
            catalogAdminPromise={catalogAdminPromise}
            documentsPromise={documentsPromise}
            paymentAccountsPromise={paymentAccountsPromise}
            externalOrdersPromise={externalOrdersPromise}
            reportsPromise={reportsPromise}
            statsPromise={statsPromise}
            inventoryPromise={inventoryPromise}
            auditPromise={auditPromise}
            approvalsPromise={approvalsPromise}
            salesDayPromise={salesDayPromise}
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
  pendingApprovals,
}: {
  activeSectionId: WorkspaceSectionId;
  role: AppRole;
  userName: string | null;
  userEmail: string | null;
  pendingApprovals: number;
}) {
  const visibleGroups = navigationGroups
    .filter((group) => !group.adminOnly || canManageStaff(role))
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => canViewSection(role, section)),
    }))
    .filter((group) => group.sections.length > 0);
  const userLabel = userName || userEmail || "Utilizator";

  return (
    <nav className="flex flex-col gap-2 px-3 py-2 lg:min-h-screen lg:gap-0 lg:px-3 lg:py-4">
      <div className="flex items-center justify-between gap-3 px-1 pb-1 lg:block lg:border-b lg:border-[#efeeeb] lg:px-2 lg:pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Nadin Auto"
            className="h-7 w-10 shrink-0 object-contain"
          />
          <p className="crm-nav-label truncate text-[15px] font-semibold tracking-tight text-[#1b1a17]">
            Nadin Auto
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <div className="rounded-full border border-[#e8e7e3] bg-[#f6f6f4] px-2.5 py-1 text-[11px] font-semibold text-[#6f6b63]">
            {role}
          </div>
          <ChangePasswordDialog compact />
          <TrustedDeviceControl compact />
          <LogoutButton compact />
        </div>
      </div>

      <div className="mobile-nav-scroll -mx-3 flex gap-1 overflow-x-auto px-3 pb-1 lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-3">
        {visibleGroups.map((group) => {
          const Icon = menuIcons[group.icon];
          const active = group.sections.includes(activeSectionId);

          return (
            <Link
              key={group.id}
              className={`motion-nav-link flex min-w-max items-center gap-2.5 rounded-lg px-3 py-2 text-sm lg:min-w-0 ${
                active
                  ? "bg-[#f1efe9] font-semibold text-[#1b1a17]"
                  : "font-medium text-[#6f6b63] hover:bg-[#f6f6f4] hover:text-[#1b1a17]"
              }`}
              href={crmSectionHref(group.sections[0])}
              title={group.label}
            >
              <Icon
                className={`size-4 shrink-0 ${active ? "text-[#2e90fa]" : "text-[#98948b]"}`}
                aria-hidden="true"
              />
              <span className="crm-nav-label whitespace-nowrap">{group.label}</span>
              {pendingApprovals > 0 && group.sections.includes("aprobari") ? (
                <span className="crm-nav-badge ml-auto rounded-full bg-[#2e90fa] px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-white">
                  {pendingApprovals}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto hidden border-t border-[#efeeeb] px-2 pt-3 lg:block">
        <SidebarCollapseButton />
        <div className="crm-account mt-2 flex items-center justify-between gap-2">
          <div className="crm-account-meta min-w-0">
            <p className="truncate text-[13px] font-semibold text-[#1b1a17]">{userLabel}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#98948b]">
              {role}
            </p>
          </div>
          <div className="crm-account-actions flex items-center gap-1.5">
            <ChangePasswordDialog compact />
            <TrustedDeviceControl compact />
            <LogoutButton compact />
          </div>
        </div>
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
        className={`button-secondary inline-flex items-center justify-center rounded-xl border border-[#e8e7e3] bg-white text-sm font-semibold text-[#6f6b63] hover:border-[#dcdad4] hover:text-[#1b1a17] ${
          compact ? "size-8" : "mt-3 w-full gap-2 px-3 py-2"
        }`}
      >
        <LogOut className="size-4" aria-hidden="true" />
        {compact ? null : <span>Ieșire</span>}
      </button>
    </form>
  );
}

function SectionTabs({
  activeSectionId,
  role,
  pendingApprovals,
}: {
  activeSectionId: WorkspaceSectionId;
  role: AppRole;
  pendingApprovals: number;
}) {
  const group = groupForSection(activeSectionId);
  const sections = group?.sections.filter((section) => canViewSection(role, section)) ?? [];
  if (sections.length <= 1) return null;

  return (
    <div className="border-b border-[#e8e7e3] bg-white px-4 lg:px-6">
      <div className="mobile-nav-scroll flex gap-1 overflow-x-auto py-2">
        {sections.map((section) => {
          const active = section === activeSectionId;
          return (
            <Link
              key={section}
              href={crmSectionHref(section)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-[#1b1a17] text-white"
                  : "text-[#6f6b63] hover:bg-[#f1f0ed] hover:text-[#1b1a17]"
              }`}
            >
              {sectionLabel(section)}
              {section === "aprobari" && pendingApprovals > 0 ? (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none ${
                    active ? "bg-[#2e90fa] text-white" : "bg-[#dbebfe] text-[#175cd3]"
                  }`}
                >
                  {pendingApprovals}
                </span>
              ) : null}
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
      className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-4 py-2.5 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
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
      warehouses={catalog.warehouses}
      triggerLabel="Adaugă produs"
    />
  );
}

async function WorkspaceLoader({
  activeSectionId,
  canModify,
  canSell,
  canBackup,
  currentUserId,
  catalogPromise,
  operationsPromise,
  partnersPromise,
  staffPromise,
  catalogAdminPromise,
  documentsPromise,
  paymentAccountsPromise,
  externalOrdersPromise,
  reportsPromise,
  statsPromise,
  inventoryPromise,
  auditPromise,
  approvalsPromise,
  salesDayPromise,
}: {
  activeSectionId: WorkspaceSectionId;
  canModify: boolean;
  canSell: boolean;
  canBackup: boolean;
  currentUserId: string;
  catalogPromise: Promise<CatalogData> | null;
  operationsPromise: Promise<OperationsData> | null;
  partnersPromise: Promise<PartnersData> | null;
  staffPromise: Promise<StaffData> | null;
  catalogAdminPromise: Promise<CatalogAdminData> | null;
  documentsPromise: Promise<DocumentsData> | null;
  paymentAccountsPromise: Promise<PaymentAccountsData> | null;
  externalOrdersPromise: Promise<ExternalOrdersData> | null;
  reportsPromise: Promise<ReportsData> | null;
  statsPromise: Promise<StatsData> | null;
  inventoryPromise: Promise<InventoryData> | null;
  auditPromise: Promise<AuditData> | null;
  approvalsPromise: Promise<ApprovalsData> | null;
  salesDayPromise: Promise<SalesDayData> | null;
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
    return <DocumentsWorkspace data={data} canModify={canModify} />;
  }

  if (activeSectionId === "conturi-plata") {
    if (!paymentAccountsPromise) return null;
    const data = await paymentAccountsPromise;
    return <PaymentAccountsWorkspace canSubmitEFactura={canModify} data={data} />;
  }

  if (activeSectionId === "la-comanda") {
    if (!externalOrdersPromise) return null;
    const data = await externalOrdersPromise;
    return <ExternalOrdersWorkspace canDelete={canModify} data={data} />;
  }

  if (activeSectionId === "rapoarte") {
    if (!reportsPromise) return null;
    const data = await reportsPromise;
    return <ReportsWorkspace data={data} canBackup={canBackup} />;
  }

  if (activeSectionId === "aprobari") {
    if (!approvalsPromise) return null;
    const data = await approvalsPromise;
    return <ApprovalWorkspace data={data} />;
  }

  if (activeSectionId === "istoric") {
    if (!auditPromise) return null;
    const data = await auditPromise;
    return <AuditWorkspace data={data} />;
  }

  if (activeSectionId === "statistici") {
    if (!statsPromise) return null;
    const data = await statsPromise;
    return <StatsWorkspace data={data} canModify={canModify} />;
  }

  if (activeSectionId === "inventar") {
    if (!inventoryPromise) return null;
    const data = await inventoryPromise;
    return <InventoryWorkspace data={data} canModify={canModify} />;
  }

  if (!operationsPromise) return null;
  const operations = await operationsPromise;

  if (activeSectionId === "vanzari") {
    if (!salesDayPromise) return null;
    const salesDay = await salesDayPromise;
    return (
      <SalesWorkspace
        canModify={canModify}
        canSell={canSell}
        operations={operations}
        salesDay={salesDay}
      />
    );
  }

  if (activeSectionId === "retururi") {
    return <ReturnsWorkspace canModify={canModify} operations={operations} />;
  }

  if (activeSectionId === "de-adus") {
    return <RestockWorkspace canModify={canModify} operations={operations} />;
  }

  if (activeSectionId === "fara-stoc") {
    return <UnavailableRestockWorkspace operations={operations} />;
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
      className="skeleton-pulse h-10 w-32 rounded-md bg-[#efeeeb]"
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
        <div className="grid gap-3 rounded-lg border border-[#e8e7e3] bg-[#fafaf9] p-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="skeleton-pulse h-11 rounded-md bg-[#efeeeb]"
            />
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="h-10 border-b border-[#e8e7e3] bg-[#fafaf9]" />
        <div className="grid gap-3 p-4">
          {Array.from({ length: isProducts ? 8 : 5 }, (_, index) => (
            <div
              key={index}
              className="skeleton-pulse h-11 rounded-md bg-[#f0efec]"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#e8e7e3] bg-white p-4">
      <div className="skeleton-pulse h-4 w-24 rounded bg-[#efeeeb]" />
      <div className="skeleton-pulse mt-3 h-8 w-16 rounded bg-[#f0efec]" />
    </div>
  );
}

const salesDayLabelFormat = new Intl.DateTimeFormat("ro-MD", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const salesMonthLabelFormat = new Intl.DateTimeFormat("ro-MD", {
  month: "long",
  year: "numeric",
});

function SalesWorkspace({
  canModify,
  canSell,
  operations,
  salesDay,
}: {
  canModify: boolean;
  canSell: boolean;
  operations: OperationsData;
  salesDay: SalesDayData;
}) {
  const { dayKey, sales, monthCount, monthLei } = salesDay;
  const dayProducts = sales.reduce(
    (total, document) =>
      total + document.lines.reduce((lineTotal, line) => lineTotal + line.quantity, 0),
    0,
  );
  const dayLei = sales.reduce((total, document) => total + documentTotalLei(document), 0);
  const selectedDate = new Date(`${dayKey}T12:00:00`);
  const today = new Date();
  const isToday =
    dayKey ===
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthName = salesMonthLabelFormat.format(selectedDate);

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SalesDayNav dayKey={dayKey} />
        <div className="flex flex-wrap items-center gap-2">
          {canModify ? <SalesRegisterExport /> : null}
          {canSell ? (
            <StockSaleDialog
              warehouses={toWarehouseOptions(operations.warehouses)}
              customers={toSupplierOptions(operations.customers)}
              suppliers={toSupplierOptions(operations.suppliers)}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DailyMetric
          label={isToday ? "Vânzări azi" : "Vânzări în ziua aleasă"}
          value={formatNumber(sales.length)}
        />
        <DailyMetric label="Produse vândute" value={formatNumber(dayProducts)} />
        <DailyMetric label="Total zi" value={`${formatMoney(dayLei)} lei`} />
        <DailyMetric
          label={`Total ${monthName}`}
          value={`${formatMoney(monthLei)} lei`}
          hint={`${formatNumber(monthCount)} vânzări în lună`}
        />
      </div>

      <div className="grid gap-3">
        <h2 className="font-semibold capitalize text-[#1b1a17]">
          {salesDayLabelFormat.format(selectedDate)}
        </h2>
        <RecentDocumentsTable
          documents={sales}
          canModify={canModify}
          emptyText={isToday ? "Nicio vânzare înregistrată azi." : "Nicio vânzare în ziua aleasă."}
        />
      </div>
    </section>
  );
}

type SaleLineWithProduct = {
  id: string;
  quantity: number;
  unitPriceEuro: { toString(): string } | null;
  externalName: string | null;
  externalCode: string | null;
  product: {
    externalCode: string | null;
    description: string;
    salePriceLei: { toString(): string } | null;
    fitment: VehicleFitmentInfo;
  } | null;
};

/** Rând secundar gri cu marca + model + ani sub denumirea produsului. */
function VehicleSubline({ fitment }: { fitment: VehicleFitmentInfo | null | undefined }) {
  const label = vehicleLabel(fitment);
  return label ? <span className="block text-xs font-normal text-[#6f6b63]">{label}</span> : null;
}

/**
 * Sale lines with the sold price; when the sold price differs from the
 * catalog price the line is flagged (red below catalog, blue above).
 */
function SaleLines({ lines }: { lines: SaleLineWithProduct[] }) {
  return (
    <div className="grid gap-1">
      {lines.map((line) => {
        const sold = line.unitPriceEuro != null ? Number(line.unitPriceEuro) : null;
        const list = line.product?.salePriceLei != null ? Number(line.product.salePriceLei) : null;
        const diff = sold != null && list != null ? sold - list : 0;
        const marked = sold != null && list != null && diff !== 0;

        return (
          <span key={line.id}>
            {(line.product?.externalCode ?? line.externalCode) ? `${line.product?.externalCode ?? line.externalCode} · ` : ""}
            {line.product?.description ?? line.externalName ?? "Piesă externă"}
            {!line.product ? (
              <span
                className="ml-1.5 rounded bg-[#dbebfe] px-1 text-xs font-semibold text-[#175cd3]"
                title="Piesă de la furnizor — nu face parte din catalogul/stocul propriu"
              >
                extern
              </span>
            ) : null}
            <span className="font-mono text-[#6f6b63]"> x{line.quantity}</span>
            {sold != null ? (
              <span
                className={`ml-1.5 whitespace-nowrap rounded px-1 font-mono text-xs font-semibold ${
                  marked
                    ? diff < 0
                      ? "bg-[#fee2e2] text-[#b91c1c]"
                      : "bg-[#dbebfe] text-[#175cd3]"
                    : "text-[#6f6b63]"
                }`}
                title={
                  marked
                    ? `Preț catalog: ${formatMoney(list)} lei (diferență ${diff > 0 ? "+" : ""}${formatMoney(diff)} lei)`
                    : undefined
                }
              >
                {formatMoney(sold)} lei{marked ? (diff < 0 ? " ↓" : " ↑") : ""}
              </span>
            ) : null}
            <VehicleSubline fitment={line.product?.fitment} />
          </span>
        );
      })}
    </div>
  );
}

function ReturnsWorkspace({
  canModify,
  operations,
}: {
  canModify: boolean;
  operations: OperationsData;
}) {
  const totalReturnedLei = operations.returns.reduce(
    (total, document) => total + Number(document.totalLei ?? 0),
    0,
  );
  // The dialog offers the most recent 30 sales to return from.
  const returnableSales: ReturnableSale[] = operations.salesArchive
    .slice(0, 30)
    .map((sale) => ({
      id: sale.id,
      number: sale.number,
      dateLabel: formatDate(sale.documentDate),
      warehouseName: sale.warehouse.name,
      partnerName: sale.partner?.name ?? null,
      lines: sale.lines.flatMap((line) =>
        line.productId && line.product
          ? [{
              productId: line.productId,
              label: `${line.product.externalCode ? `${line.product.externalCode} · ` : ""}${line.product.description}`,
              quantity: line.quantity,
              unitPriceLei: Number(line.unitPriceEuro ?? 0),
            }]
          : [],
      ),
    }));

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <DailyMetric label="Retururi înregistrate" value={formatNumber(operations.returns.length)} />
        <DailyMetric label="Valoare returnată" value={`${formatMoney(totalReturnedLei)} lei`} />
      </div>
      {canModify ? (
        <div className="flex justify-end">
          <ReturnDialog sales={returnableSales} />
        </div>
      ) : null}
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Data</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Depozit</TableHead>
                <TableHead>Produse</TableHead>
                <TableHead align="right">Cantitate</TableHead>
                <TableHead align="right">Total</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {operations.returns.length > 0 ? (
                operations.returns.map((document) => (
                  <tr key={document.id} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                    <TableCell>{formatDate(document.documentDate)}</TableCell>
                    <TableCell className="font-semibold">
                      Retur #{document.number}
                      {document.notes ? (
                        <p className="mt-0.5 text-xs font-normal text-[#6f6b63]">{document.notes}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>{document.warehouse.name}</TableCell>
                    <TableCell>
                      <div className="grid gap-1">
                        {document.lines.map((line) => (
                          <span key={line.id}>
                            {line.product?.externalCode ? `${line.product.externalCode} · ` : ""}
                            {line.product?.description ?? line.externalName ?? "Piesă externă"}
                            <span className="font-mono text-[#6f6b63]"> x{line.quantity}</span>
                            <VehicleSubline fitment={line.product?.fitment} />
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell align="right" className="font-mono">
                      {formatNumber(document.lines.reduce((sum, line) => sum + line.quantity, 0))}
                    </TableCell>
                    <TableCell align="right" className="font-mono font-semibold">
                      {formatMoney(documentTotalLei(document))} lei
                    </TableCell>
                    {canModify ? (
                      <TableCell align="right">
                        <DocumentRowActions
                          id={document.id}
                          title={`Retur #${document.number}`}
                          documentDate={document.documentDate.toISOString().slice(0, 10)}
                          documentType={document.type}
                          notes={document.notes ?? ""}
                          partnerId={document.partner?.id ?? ""}
                          partnerName={document.partner?.name ?? ""}
                          lines={toDocLines(document)}
                        />
                      </TableCell>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={canModify ? 7 : 6}>
                    Nu există retururi încă.
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

function RestockWorkspace({
  canModify,
  operations,
}: {
  canModify: boolean;
  operations: OperationsData;
}) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="motion-card flex flex-col gap-3 rounded-xl border border-[#e8e7e3] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#1b1a17]">Reaprovizionare Pavilion 110A</h2>
          <p className="text-sm text-[#6f6b63]">
            Produsele vândute din 110A rămân aici până sunt bifate ca aduse.
          </p>
        </div>
        {canModify ? (
          <StockTransferDialog warehouses={toWarehouseOptions(operations.warehouses)} />
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DailyMetric label="Poziții active" value={formatNumber(operations.restockPending.length)} />
        <DailyMetric label="Fără stoc" value={formatNumber(operations.restockUnavailable.length)} />
      </div>
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Solicitări</TableHead>
                <TableHead align="right">De adus în 110A</TableHead>
                <TableHead>Prima vânzare</TableHead>
                {canModify ? <TableHead align="right">Bifează</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {operations.restockPending.length > 0 ? (
                operations.restockPending.map((line) => (
                  <tr key={line.productId} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatText(line.product.externalCode)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {line.product.description}
                      <VehicleSubline fitment={line.product.fitment} />
                    </TableCell>
                    <TableCell align="right" className="font-mono">{formatNumber(line.taskCount)}</TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{formatNumber(line.quantity)}</TableCell>
                    <TableCell>{formatDate(line.oldestRequestedAt)}</TableCell>
                    {canModify ? (
                      <TableCell align="right">
                        <div className="flex flex-wrap justify-end gap-3">
                          <RestockCheckbox
                            kind="delivered"
                            label="Adus"
                            productId={line.productId}
                            warehouseId={line.warehouseId}
                          />
                          <RestockCheckbox
                            kind="unavailable"
                            label="Nu mai este"
                            productId={line.productId}
                            warehouseId={line.warehouseId}
                          />
                        </div>
                      </TableCell>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={canModify ? 6 : 5}>
                    Nu sunt produse de adus în Pavilion 110A.
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

function UnavailableRestockWorkspace({ operations }: { operations: OperationsData }) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <DailyMetric label="Poziții fără stoc" value={formatNumber(operations.restockUnavailable.length)} />
        <DailyMetric
          label="Cantitate totală"
          value={formatNumber(
            operations.restockUnavailable.reduce((sum, line) => sum + line.quantity, 0),
          )}
        />
      </div>
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="border-b border-[#e8e7e3] px-4 py-3">
          <h2 className="font-semibold text-[#1b1a17]">Marcate fără stoc</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Cantitate</TableHead>
                <TableHead>Ultima vânzare</TableHead>
              </tr>
            </thead>
            <tbody>
              {operations.restockUnavailable.length > 0 ? (
                operations.restockUnavailable.map((line) => (
                  <tr key={line.productId} className="motion-table-row border-t border-[#efeeeb]">
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatText(line.product.externalCode)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {line.product.description}
                      <VehicleSubline fitment={line.product.fitment} />
                    </TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{formatNumber(line.quantity)}</TableCell>
                    <TableCell>{formatDate(line.latestRequestedAt)}</TableCell>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={4}>
                    Nu sunt produse marcate fără stoc.
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

function DailyMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="motion-card rounded-xl border border-[#e8e7e3] bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98948b]">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums text-[#1b1a17]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#98948b]">{hint}</p> : null}
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
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
                  <tr>
                    {canModify ? <TableHead>{""}</TableHead> : null}
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
              .map((compatibility) => `${compatibility.title} · Ani ${compatibility.years}`)
              .join(" • ")}
            aria-label={`Selectează ${product.description} pentru sticker`}
            className="size-4 cursor-pointer accent-[#1b1a17]"
          />
        </TableCell>
      ) : null}
      <TableCell className="font-mono text-xs font-semibold">{formatText(product.externalCode)}</TableCell>
      <TableCell>
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
            .join(" · ")}
        </p>
      </TableCell>
      <TableCell align="right" className="font-semibold tabular-nums">
        {product.salePriceLei != null ? `${formatMoney(product.salePriceLei)} lei` : "—"}
      </TableCell>
      {canModify ? (
        <TableCell align="right" className="tabular-nums text-[#6f6b63]">
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
  const suppliers = toSupplierOptions(operations.suppliers);
  const documents = operations.recentDocuments.filter((document) =>
    activeSectionId === "receptii" ? document.type === "RECEIPT" : document.type === "ADJUSTMENT",
  );

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      {canModify ? (
        <div className="flex justify-end">
          {activeSectionId === "receptii" ? (
            <StockDocumentDialog suppliers={suppliers} warehouses={warehouses} />
          ) : (
            <StockTransferDialog warehouses={warehouses} />
          )}
        </div>
      ) : null}
      <RecentDocumentsTable documents={documents} canModify={canModify} suppliers={suppliers} />
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
    productId: string | null;
    externalName: string | null;
    externalCode: string | null;
    externalSupplierId: string | null;
    quantity: number;
    unitPriceEuro: { toString(): string } | null;
    unitCostLei: { toString(): string } | null;
    product: { description: string; externalCode: string | null } | null;
  }[];
}) {
  const usesSalePrice = doc.type === "SALE" || doc.type === "RETURN";
  return doc.lines.map((l) => {
    const price = usesSalePrice ? l.unitPriceEuro : l.unitCostLei;
    return {
      productId: l.productId ?? "",
      label: l.product
        ? `${l.product.externalCode ? `${l.product.externalCode} · ` : ""}${l.product.description}`
        : `${l.externalCode ? `${l.externalCode} · ` : ""}${l.externalName ?? "Piesă externă"}`,
      quantity: String(l.quantity),
      price: price != null ? String(price) : "",
      externalName: l.externalName ?? "",
      externalCode: l.externalCode ?? "",
      externalSupplierId: l.externalSupplierId ?? "",
      // Pe linii externe unitCostLei = costul de achiziție.
      externalCost: !l.productId && l.unitCostLei != null ? String(l.unitCostLei) : "",
    };
  });
}

const dateTimeFormat = new Intl.DateTimeFormat("ro-MD", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Serializare server → client pentru drawer-ul „Detalii". */
function toDocumentDetails(
  doc: {
    id: string;
    type: string;
    number: number;
    documentDate: Date;
    createdAt: Date;
    updatedAt: Date;
    notes: string | null;
    cashRegistered: boolean | null;
    paymentMethod: "CASH" | "CARD" | null;
    totalLei: { toString(): string } | null;
    totalEuro: { toString(): string } | null;
    warehouse: { name: string };
    partner: { name: string; phone: string | null } | null;
    lines: {
      id: string;
      productId: string | null;
      externalName: string | null;
      externalCode: string | null;
      quantity: number;
      unitPriceEuro: { toString(): string } | null;
      unitCostLei: { toString(): string } | null;
      product: {
        description: string;
        externalCode: string | null;
        fitment: {
          yearStart: number | null;
          yearEnd: number | null;
          yearOpenEnded: boolean;
          carModel: { name: string; brand: { name: string } };
        };
      } | null;
    }[];
  },
  canExport: boolean,
): DocumentDetailsValue {
  const usesSalePrice = doc.type === "SALE" || doc.type === "RETURN";
  return {
    id: doc.id,
    typeLabel: formatDocumentType(doc.type),
    number: doc.number,
    date: formatDate(doc.documentDate),
    warehouse: doc.warehouse.name,
    partnerLabel: usesSalePrice ? "Client" : "Furnizor",
    partner: doc.partner?.name ?? null,
    partnerPhone: doc.partner?.phone ?? null,
    notes: doc.notes,
    createdAt: dateTimeFormat.format(doc.createdAt),
    updatedAt: dateTimeFormat.format(doc.updatedAt),
    totalLei: documentTotalLei(doc),
    isSale: doc.type === "SALE",
    cashRegistered: doc.cashRegistered,
    paymentMethod: doc.paymentMethod,
    lines: doc.lines.map((line) => {
      const price = usesSalePrice ? line.unitPriceEuro : line.unitCostLei;
      return {
        id: line.id,
        code: line.product?.externalCode ?? line.externalCode ?? (line.product ? null : "extern"),
        description: line.product?.description ?? line.externalName ?? "Piesă externă",
        vehicle: vehicleLabel(line.product?.fitment),
        quantity: line.quantity,
        price: price != null ? Number(price) : null,
      };
    }),
    canExport,
    showVat: COMPANY.vatPayer,
  };
}

/** Export „Registrul vânzărilor" (PDF/Excel) pe un interval de date. */
function SalesRegisterExport() {
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);
  const inputCls =
    "h-9 rounded-md border border-[#e8e7e3] bg-white px-2 text-sm text-[#1b1a17]";
  const buttonCls =
    "button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]";

  return (
    <form
      action="/api/export/sales-register"
      method="get"
      target="_blank"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e8e7e3] bg-white px-3 py-2"
    >
      <span className="text-xs font-semibold text-[#6f6b63]">Registru vânzări</span>
      <input className={inputCls} type="date" name="from" defaultValue={firstOfMonth} aria-label="De la" />
      <input className={inputCls} type="date" name="to" defaultValue={today} aria-label="Până la" />
      <button className={buttonCls} type="submit" name="format" value="pdf">
        <FileText className="size-3.5" aria-hidden="true" /> PDF
      </button>
      <button className={buttonCls} type="submit" name="format" value="xlsx">
        <Download className="size-3.5" aria-hidden="true" /> Excel
      </button>
    </form>
  );
}

function RecentDocumentsTable({
  documents,
  canModify = false,
  suppliers = [],
  emptyText = "Nu există documente încă.",
}: {
  documents: OperationsData["recentDocuments"];
  canModify?: boolean;
  suppliers?: SupplierOption[];
  emptyText?: string;
}) {
  return (
    <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
            <tr>
              <TableHead>Data</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Depozit</TableHead>
              <TableHead>Produs</TableHead>
              <TableHead align="right">Cantitate</TableHead>
              <TableHead align="right">Total</TableHead>
              {COMPANY.vatPayer ? <TableHead align="right">TVA (÷6)</TableHead> : null}
              <TableHead>Casă</TableHead>
              <TableHead>Plată</TableHead>
              <TableHead align="right">Acțiuni</TableHead>
            </tr>
          </thead>
          <tbody>
            {documents.length > 0 ? documents.map((document) => {
              const docTotal = documentTotalLei(document);
              return (
              <tr key={document.id} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                <TableCell>{formatDate(document.documentDate)}</TableCell>
                <TableCell className="font-semibold">{formatDocumentType(document.type)} #{document.number}</TableCell>
                <TableCell>{document.warehouse.name}</TableCell>
                <TableCell>
                  {document.type === "SALE" ? (
                    <SaleLines lines={document.lines} />
                  ) : (
                    <div className="grid gap-1">
                      {document.lines.map((line) => (
                        <span key={line.id}>
                          {line.product
                            ? line.product.description
                            : `${line.externalCode ? `${line.externalCode} · ` : ""}${line.externalName ?? "Piesă externă"}`}
                          <span className="font-mono text-[#6f6b63]"> x{line.quantity}</span>
                          <VehicleSubline fitment={line.product?.fitment} />
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell align="right" className="font-mono">
                  {formatNumber(document.lines.reduce((sum, line) => sum + line.quantity, 0))}
                </TableCell>
                <TableCell align="right" className="font-mono font-semibold">{formatMoney(docTotal)} lei</TableCell>
                {COMPANY.vatPayer ? (
                  <TableCell align="right" className="font-mono text-[#6f6b63]">{formatMoney(docTotal / 6)} lei</TableCell>
                ) : null}
                <TableCell>
                  {document.type === "SALE" ? (
                    <div className="grid gap-2">
                      <CashRegisterBadge value={document.cashRegistered} />
                      {canModify ? (
                        <CashRegisterControl
                          documentId={document.id}
                          value={document.cashRegistered}
                        />
                      ) : null}
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {document.type === "SALE" ? (
                    <div className="grid gap-2">
                      <SalePaymentMethodBadge value={document.paymentMethod} />
                      {canModify ? (
                        <SalePaymentMethodControl
                          documentId={document.id}
                          value={document.paymentMethod}
                        />
                      ) : null}
                    </div>
                  ) : "—"}
                </TableCell>
                <TableCell align="right">
                  <div className="flex justify-end gap-2">
                    <DocumentDetailsButton details={toDocumentDetails(document, canModify)} />
                    {canModify ? (
                      <DocumentRowActions
                        id={document.id}
                        title={`${formatDocumentType(document.type)} #${document.number}`}
                        documentDate={document.documentDate.toISOString().slice(0, 10)}
                        documentType={document.type}
                        notes={document.notes ?? ""}
                        partnerId={document.partner?.id ?? ""}
                        partnerName={document.partner?.name ?? ""}
                        suppliers={suppliers}
                        lines={toDocLines(document)}
                        isTransfer={Boolean(document.transferGroupId)}
                      />
                    ) : null}
                  </div>
                </TableCell>
              </tr>
              );
            }) : (
              <tr>
                <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={COMPANY.vatPayer ? 10 : 9}>
                  {emptyText}
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
  "motion-table-row border-t border-[#efeeeb] align-top hover:bg-[#f6f6f4]";

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
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
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
        {isEmpty ? <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">{empty}</div> : null}
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
            <TableCell className="font-semibold text-[#1b1a17]">{b.name}</TableCell>
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
            <TableCell className="font-semibold text-[#1b1a17]">
              {t.name}
              {t.nameRu ? <p className="mt-1 text-xs font-normal text-[#6f6b63]">RU: {t.nameRu}</p> : null}
            </TableCell>
            <TableCell align="right" className="font-mono">{formatNumber(t._count.products)}</TableCell>
            {canModify ? (
              <TableCell align="right">
                <RowActions>
                  <TypeDialog entity={{ id: t.id, name: t.name, nameRu: t.nameRu }} triggerKind="row" triggerLabel="Editează" />
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
            <TableCell className="font-semibold text-[#1b1a17]">{m.name}</TableCell>
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
            <TableCell className="font-semibold text-[#1b1a17]">
              {f.label}
              {f.labelRu ? <p className="mt-1 text-xs font-normal text-[#6f6b63]">RU: {f.labelRu}</p> : null}
            </TableCell>
            <TableCell>{f.carModel.brand.name} {f.carModel.name}</TableCell>
            <TableCell>{formatYearLabel(f.yearStart, f.yearEnd, f.yearOpenEnded)}</TableCell>
            <TableCell align="right" className="font-mono">{formatNumber(f._count.products)}</TableCell>
            {canModify ? (
              <TableCell align="right">
                <RowActions>
                  <FitmentDialog
                    models={models}
                    fitment={{ id: f.id, carModelId: f.carModelId, label: f.label, labelRu: f.labelRu, yearStart: f.yearStart, yearEnd: f.yearEnd, yearOpenEnded: f.yearOpenEnded }}
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
          <TableCell className="font-semibold text-[#1b1a17]">{w.name}</TableCell>
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

function DocumentsWorkspace({ data, canModify }: { data: DocumentsData; canModify: boolean }) {
  const { documents, filters, partners, page, pageCount, total, pageSize } = data;
  const filterInputCls =
    "h-10 rounded-md border border-[#e8e7e3] bg-white px-2.5 text-sm text-[#1b1a17]";
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <form
        action="/crm"
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-xl border border-[#e8e7e3] bg-white px-3 py-3"
      >
        <input type="hidden" name="section" value="documente" />
        <label className="grid gap-1 text-xs font-semibold text-[#6f6b63]">
          Tip
          <select className={filterInputCls} name="dtype" defaultValue={filters.dtype}>
            <option value="">Toate</option>
            <option value="RECEIPT">Recepții</option>
            <option value="SALE">Vânzări</option>
            <option value="RETURN">Retururi</option>
            <option value="ADJUSTMENT">Ajustări/Transferuri</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6f6b63]">
          Partener
          <select className={filterInputCls} name="partner" defaultValue={filters.partner}>
            <option value="">Toți</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6f6b63]">
          De la
          <input className={filterInputCls} type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[#6f6b63]">
          Până la
          <input className={filterInputCls} type="date" name="to" defaultValue={filters.to} />
        </label>
        <button
          type="submit"
          className="button-primary h-10 rounded-md bg-[#1b1a17] px-4 text-sm font-semibold text-white hover:bg-[#33312c]"
        >
          Filtrează
        </button>
        <Link
          href="/crm?section=documente"
          className="h-10 content-center px-2 text-sm font-medium text-[#1b1a17] underline decoration-[#2e90fa] underline-offset-4"
        >
          Resetează
        </Link>
        <span className="ml-auto text-sm text-[#6f6b63]">
          {start}-{end} din {formatNumber(total)} documente
        </span>
      </form>

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm" style={{ minWidth: "900px" }}>
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Data</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Depozit</TableHead>
                <TableHead>Partener</TableHead>
                <TableHead align="right">Produse</TableHead>
                <TableHead align="right">Total</TableHead>
                <TableHead>Casă</TableHead>
                <TableHead>Plată</TableHead>
                <TableHead align="right">Export intern</TableHead>
                <TableHead align="right">Acțiuni</TableHead>
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
                  <TableCell>
                    {d.type === "SALE" ? (
                      <div className="grid gap-2">
                        <CashRegisterBadge value={d.cashRegistered} />
                        {canModify ? (
                          <CashRegisterControl
                            documentId={d.id}
                            value={d.cashRegistered}
                          />
                        ) : null}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {d.type === "SALE" ? (
                      <div className="grid gap-2">
                        <SalePaymentMethodBadge value={d.paymentMethod} />
                        {canModify ? (
                          <SalePaymentMethodControl
                            documentId={d.id}
                            value={d.paymentMethod}
                          />
                        ) : null}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-1.5">
                      <a
                        href={`/api/export/document/${d.id}/pdf`}
                        className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] px-2.5 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                      >
                        <FileText className="size-3.5" aria-hidden="true" /> PDF intern
                      </a>
                      {d.type !== "ADJUSTMENT" ? (
                        <a
                          href={`/api/export/invoice/${d.id}`}
                          className="button-secondary inline-flex items-center gap-1.5 rounded-md border border-[#e8e7e3] px-2.5 py-1.5 text-xs font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
                        >
                          <Download className="size-3.5" aria-hidden="true" /> Excel intern
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-2">
                      <DocumentDetailsButton details={toDocumentDetails(d, canModify)} />
                      {canModify ? (
                        <DocumentRowActions
                          id={d.id}
                          title={`${formatDocType(d.type)} #${d.number}`}
                          documentDate={d.documentDate.toISOString().slice(0, 10)}
                          documentType={d.type}
                          notes={d.notes ?? ""}
                          partnerId={d.partner?.id ?? ""}
                          partnerName={d.partner?.name ?? ""}
                          lines={toDocLines(d)}
                          isTransfer={Boolean(d.transferGroupId)}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {documents.length === 0 ? <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">Niciun document pentru filtrele curente.</div> : null}
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-[#6f6b63]">
            Pagina {page} din {pageCount}
          </p>
          <div className="flex gap-2">
            <PagerLink
              disabled={page <= 1}
              href={crmDocumentsHref({ ...filters, dpage: page - 1 })}
              label="Înapoi"
            />
            <PagerLink
              disabled={page >= pageCount}
              href={crmDocumentsHref({ ...filters, dpage: page + 1 })}
              label="Înainte"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PagerLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
  if (disabled) {
    return (
      <span className="rounded-md border border-[#e8e7e3] px-3 py-1.5 font-medium text-[#c6c3bc]">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="button-secondary rounded-md border border-[#e8e7e3] bg-white px-3 py-1.5 font-medium text-[#1b1a17] hover:bg-[#f6f6f4]"
    >
      {label}
    </Link>
  );
}

const AUDIT_ACTION_META: Record<string, { label: string; className: string }> = {
  CREATE: { label: "Creare", className: "bg-[#dcfce7] text-[#15803d]" },
  UPDATE: { label: "Editare", className: "bg-[#dbebfe] text-[#175cd3]" },
  DELETE: { label: "Ștergere", className: "bg-[#fee2e2] text-[#b91c1c]" },
};

const AUDIT_ENTITY_LABEL: Record<string, string> = {
  StockDocument: "Operațiune",
  Product: "Produs",
};

function AuditWorkspace({ data }: { data: AuditData }) {
  const filters: { key: string | undefined; label: string }[] = [
    { key: undefined, label: "Toate" },
    { key: "CREATE", label: "Creări" },
    { key: "UPDATE", label: "Editări" },
    { key: "DELETE", label: "Ștergeri" },
  ];

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => {
          const active = data.filters.act === filter.key;
          const href = crmAuditHref({
            act: filter.key,
            doc: data.filters.doc,
          });
          return (
            <Link
              key={filter.label}
              href={href}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-[#1b1a17] bg-[#1b1a17] text-white"
                  : "border-[#e8e7e3] bg-white text-[#1b1a17] hover:bg-[#f6f6f4]"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
        {data.filters.doc ? (
          <Link
            href="/crm?section=istoric"
            className="rounded-full border border-[#2e90fa] bg-[#dbebfe] px-3.5 py-1.5 text-sm font-semibold text-[#175cd3] hover:bg-[#bedcfc]"
          >
            Filtru: un singur document ✕
          </Link>
        ) : null}
      </div>

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Data și ora</TableHead>
                <TableHead>Utilizator</TableHead>
                <TableHead>Acțiune</TableHead>
                <TableHead>Ce s-a întâmplat</TableHead>
                <TableHead align="right">Detalii</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.entries.length > 0 ? (
                data.entries.map((entry) => <AuditRowView key={entry.id} entry={entry} />)
              ) : (
                <tr>
                  <td className="px-3 py-12 text-center text-[#6f6b63]" colSpan={5}>
                    Nu există intrări în jurnal pentru filtrele curente.
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

function AuditRowView({ entry }: { entry: AuditRow }) {
  const meta = AUDIT_ACTION_META[entry.action] ?? {
    label: entry.action,
    className: "bg-[#f0efec] text-[#6f6b63]",
  };
  const details = entry.details as
    | { deleted?: unknown; restoredDocumentId?: string }
    | null;
  const canRestore =
    entry.action === "DELETE" &&
    entry.entity === "StockDocument" &&
    Boolean(details?.deleted) &&
    !details?.restoredDocumentId;

  return (
    <tr className="motion-table-row border-t border-[#efeeeb] align-top hover:bg-[#f6f6f4]">
      <TableCell className="whitespace-nowrap font-mono text-xs">
        {dateTimeFormat.format(entry.createdAt)}
      </TableCell>
      <TableCell>
        <p className="font-medium">{entry.userName || entry.userEmail || "—"}</p>
        {entry.userName && entry.userEmail ? (
          <p className="mt-0.5 text-xs text-[#98948b]">{entry.userEmail}</p>
        ) : null}
      </TableCell>
      <TableCell>
        <span
          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
        >
          {meta.label}
        </span>
        <p className="mt-1 text-xs text-[#98948b]">
          {AUDIT_ENTITY_LABEL[entry.entity] ?? entry.entity}
        </p>
        {entry.reviewStatus === "PENDING" ? (
          <span className="mt-1 inline-block whitespace-nowrap rounded-full bg-[#dbebfe] px-2 py-0.5 text-[11px] font-semibold text-[#175cd3]">
            Neaprobat
          </span>
        ) : null}
        {entry.reviewStatus === "FLAGGED" ? (
          <span
            className="mt-1 inline-block whitespace-nowrap rounded-full bg-[#fee2e2] px-2 py-0.5 text-[11px] font-semibold text-[#b91c1c]"
            title={entry.reviewNote ?? undefined}
          >
            Semnalat
          </span>
        ) : null}
      </TableCell>
      <TableCell>{entry.summary}</TableCell>
      <TableCell align="right">
        <div className="flex flex-col items-end gap-2">
          {canRestore ? <RestoreButton auditId={entry.id} title={entry.summary} /> : null}
          {details?.restoredDocumentId ? (
            <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-xs font-semibold text-[#15803d]">
              Restaurat
            </span>
          ) : null}
          {entry.details != null ? (
            <details className="text-left">
              <summary className="cursor-pointer whitespace-nowrap text-xs font-semibold text-[#1b1a17] underline decoration-[#2e90fa] underline-offset-4">
                Vezi detalii
              </summary>
              <pre className="mt-2 max-h-72 max-w-xl overflow-auto rounded-md border border-[#e8e7e3] bg-[#fafaf9] p-2 text-left font-mono text-[11px] leading-relaxed text-[#33312c]">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </details>
          ) : (
            <span className="text-xs text-[#98948b]">—</span>
          )}
        </div>
      </TableCell>
    </tr>
  );
}

function ReportsWorkspace({ data, canBackup }: { data: ReportsData; canBackup: boolean }) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      {canBackup ? (
        <div className="flex justify-end">
          <a
            href="/api/export/backup"
            className="button-secondary inline-flex items-center gap-2 rounded-md border border-[#e8e7e3] bg-white px-3.5 py-2 text-sm font-semibold text-[#1b1a17] hover:bg-[#f6f6f4]"
          >
            <Download className="size-4" aria-hidden="true" /> Backup complet (Excel)
          </a>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DailyMetric label="Produse" value={formatNumber(data.totalProducts)} />
        <DailyMetric label="Stoc total (buc.)" value={formatNumber(data.totalStock)} />
        <DailyMetric
          label="Valoare stoc"
          value={`${formatMoney(data.valueEur)} EUR`}
          hint={`${formatMoney(data.stockValueLei)} lei la preț de vânzare`}
        />
        <DailyMetric
          label="Vânzări 30 zile"
          value={formatNumber(data.sales30Count)}
          hint={`${formatMoney(data.sales30Lei)} lei încasați`}
        />
      </div>

      <CurrencyWidget valueLei={data.stockValueLei} rates={data.rates} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
          <div className="border-b border-[#efeeeb] px-4 py-3 font-semibold text-[#1b1a17]">Stoc pe depozit</div>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {data.warehouseStock.map((w) => {
                const max = Math.max(...data.warehouseStock.map((x) => x.total_quantity), 1);
                return (
                  <tr key={w.id} className={adminRowCls}>
                    <TableCell className="font-medium">
                      {w.name}
                      <div className="mt-1.5 h-1.5 w-full max-w-56 rounded-full bg-[#f0efec]">
                        <div
                          className="h-1.5 rounded-full bg-[#2e90fa]"
                          style={{ width: `${Math.max((w.total_quantity / max) * 100, w.total_quantity > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell align="right" className="font-mono font-semibold">{formatNumber(w.total_quantity)}</TableCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
          <div className="border-b border-[#efeeeb] px-4 py-3 font-semibold text-[#1b1a17]">
            Produse sub stocul minim
            <span className="ml-2 text-xs font-normal text-[#98948b]">prag per produs, implicit 3</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-left text-sm">
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.id} className={adminRowCls}>
                    <TableCell className="font-mono text-xs">{formatText(p.code)}</TableCell>
                    <TableCell>{p.description}</TableCell>
                    <TableCell align="right" className="whitespace-nowrap font-mono font-semibold">
                      {p.stock ?? 0}
                      <span className="font-normal text-[#98948b]"> / prag {p.min_stock}</span>
                    </TableCell>
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

function InventoryWorkspace({ data, canModify }: { data: InventoryData; canModify: boolean }) {
  const totalQuantity = data.stocks.reduce((sum, row) => sum + row.quantity, 0);
  const warehouseOptions = data.warehouses.map((w) => ({ id: w.id, name: w.name }));

  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {data.warehouses.map((warehouse) => {
          const active = warehouse.id === data.selected?.id;
          return (
            <Link
              key={warehouse.id}
              href={`/crm?section=inventar&wh=${warehouse.id}`}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "border-[#1b1a17] bg-[#1b1a17] text-white"
                  : "border-[#e8e7e3] bg-white text-[#1b1a17] hover:bg-[#f6f6f4]"
              }`}
            >
              {warehouse.name}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DailyMetric label="Poziții în depozit" value={formatNumber(data.stocks.length)} />
        <DailyMetric label="Bucăți în depozit" value={formatNumber(totalQuantity)} />
      </div>

      {canModify ? (
        <div className="flex justify-end">
          <InventoryDialog warehouses={warehouseOptions} defaultWarehouseId={data.selected?.id} />
        </div>
      ) : null}

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="border-b border-[#e8e7e3] px-4 py-3">
          <h2 className="font-semibold text-[#1b1a17]">
            Stoc în sistem — {data.selected?.name ?? "fără depozit"}
          </h2>
          <p className="mt-1 text-sm text-[#6f6b63]">
            Numără fizic produsele și folosește „Corectează stocul” pentru diferențe.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Cod</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Preț vânzare</TableHead>
                <TableHead align="right">În sistem</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.stocks.length > 0 ? (
                data.stocks.map((row) => (
                  <tr key={row.id} className="motion-table-row border-t border-[#efeeeb] hover:bg-[#f6f6f4]">
                    <TableCell className="font-mono text-xs font-semibold">
                      {formatText(row.product.externalCode)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.product.description}
                      <VehicleSubline fitment={row.product.fitment} />
                    </TableCell>
                    <TableCell align="right" className="font-mono">
                      {row.product.salePriceLei != null ? `${formatMoney(row.product.salePriceLei)} lei` : "—"}
                    </TableCell>
                    <TableCell align="right" className="font-mono font-semibold">
                      {formatNumber(row.quantity)}
                    </TableCell>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={4}>
                    Nu există stoc înregistrat în acest depozit.
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

function StatsWorkspace({ data, canModify }: { data: StatsData; canModify: boolean }) {
  return (
    <section className="motion-page grid gap-4 p-4 lg:p-5">
      <div className={`grid gap-3 sm:grid-cols-2 ${canModify ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <DailyMetric
          label="Venit (30 zile)"
          value={`${formatMoney(data.last30.revenueLei)} lei`}
          hint={`${formatNumber(data.last30.quantity)} produse vândute`}
        />
        {canModify ? (
          <DailyMetric
            label="Profit (30 zile)"
            value={`${formatMoney(data.last30.profitLei)} lei`}
            hint={
              data.last30.revenueLei > 0
                ? `marjă ${Math.round((data.last30.profitLei / data.last30.revenueLei) * 100)}%`
                : undefined
            }
          />
        ) : null}
        <DailyMetric
          label="Vânzări (30 zile)"
          value={formatNumber(data.last30.salesCount)}
          hint={`coș mediu ${formatMoney(data.last30.avgSaleLei)} lei`}
        />
        <DailyMetric
          label="Retururi (13 luni)"
          value={formatNumber(data.returnsCount)}
          hint={`${formatMoney(data.returnsLei)} lei returnați`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DailyChart rows={data.daily} canModify={canModify} />
        <MonthlyChart rows={data.monthly} canModify={canModify} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PeriodStatsTable title="Pe săptămâni (ultimele 8)" rows={data.weekly} canModify={canModify} />
        <PeriodStatsTable title="Pe luni (ultimele 12)" rows={data.monthly} canModify={canModify} />
      </div>

      <PeriodStatsTable title="Pe zile (ultimele 14 cu vânzări)" rows={data.daily} canModify={canModify} />

      <TopProductsChart rows={data.topProducts} />

      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="border-b border-[#e8e7e3] px-4 py-3">
          <h2 className="font-semibold text-[#1b1a17]">Top produse vândute (30 zile)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Produs</TableHead>
                <TableHead align="right">Cantitate</TableHead>
                <TableHead align="right">Venit</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.length > 0 ? (
                data.topProducts.map((product) => {
                  const max = data.topProducts[0]?.quantity || 1;
                  return (
                    <tr key={product.productId} className="motion-table-row border-t border-[#efeeeb]">
                      <TableCell>
                        <p className="font-medium text-[#1b1a17]">{product.label}</p>
                        <div className="mt-1.5 h-1.5 w-full max-w-64 rounded-full bg-[#f0efec]">
                          <div
                            className="h-1.5 rounded-full bg-[#2e90fa]"
                            style={{ width: `${Math.max((product.quantity / max) * 100, 4)}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell align="right" className="font-mono font-semibold">{formatNumber(product.quantity)}</TableCell>
                      <TableCell align="right" className="font-mono">{formatMoney(product.revenueLei)} lei</TableCell>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={3}>
                    Nu există vânzări în ultimele 30 de zile.
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

function PeriodStatsTable({
  title,
  rows,
  canModify,
}: {
  title: string;
  rows: StatsData["daily"];
  canModify: boolean;
}) {
  const max = Math.max(...rows.map((row) => row.revenueLei), 1);

  return (
    <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
      <div className="border-b border-[#e8e7e3] px-4 py-3">
        <h2 className="font-semibold text-[#1b1a17]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
            <tr>
              <TableHead>Perioadă</TableHead>
              <TableHead align="right">Vânzări</TableHead>
              <TableHead align="right">Buc.</TableHead>
              <TableHead align="right">Venit</TableHead>
              {canModify ? <TableHead align="right">Cost</TableHead> : null}
              {canModify ? <TableHead align="right">Profit</TableHead> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.key} className="motion-table-row border-t border-[#efeeeb]">
                  <TableCell className="capitalize">
                    <p className="font-semibold">{row.label}</p>
                    <div className="mt-1.5 h-1.5 w-full max-w-48 rounded-full bg-[#f0efec]">
                      <div
                        className="h-1.5 rounded-full bg-[#2e90fa]"
                        style={{ width: `${Math.max((row.revenueLei / max) * 100, row.revenueLei > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell align="right" className="font-mono">{formatNumber(row.salesCount)}</TableCell>
                  <TableCell align="right" className="font-mono">{formatNumber(row.quantity)}</TableCell>
                  <TableCell align="right" className="font-mono font-semibold">{formatMoney(row.revenueLei)} lei</TableCell>
                  {canModify ? (
                    <TableCell align="right" className="font-mono text-[#6f6b63]">{formatMoney(row.costLei)} lei</TableCell>
                  ) : null}
                  {canModify ? (
                    <TableCell
                      align="right"
                      className={`font-mono font-semibold ${row.profitLei < 0 ? "text-[#b91c1c]" : "text-[#15803d]"}`}
                    >
                      {formatMoney(row.profitLei)} lei
                    </TableCell>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-10 text-center text-[#6f6b63]" colSpan={canModify ? 6 : 4}>
                  Nu există date pentru această perioadă.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Nume</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>IDNO / TVA</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Adresă</TableHead>
                <TableHead align="right">Documente</TableHead>
                {canModify ? <TableHead align="right">Acțiuni</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr
                  key={partner.id}
                  className="motion-table-row border-t border-[#efeeeb] align-top hover:bg-[#f6f6f4]"
                >
                  <TableCell className="font-semibold text-[#1b1a17]">
                    {partner.name}
                  </TableCell>
                  <TableCell>{formatPartnerKind(partner.kind)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <span className="block">{formatText(partner.idno)}</span>
                    {partner.vatCode ? <span className="mt-0.5 block text-[#98948b]">TVA {partner.vatCode}</span> : null}
                  </TableCell>
                  <TableCell className="text-[#6f6b63]">
                    <span className="block">{formatText(partner.phone)}</span>
                    {partner.email ? <span className="mt-0.5 block">{partner.email}</span> : null}
                  </TableCell>
                  <TableCell className="max-w-xs text-[#6f6b63]">
                    {formatText(partner.address)}
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-mono font-semibold text-[#1b1a17]">
                      {formatNumber(partner._count.documents + partner._count.paymentAccounts)}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#98948b]">
                      {partner._count.paymentAccounts} conturi
                    </span>
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
          <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">
            Nu există parteneri încă.
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
      <div className="motion-card overflow-hidden rounded-xl border border-[#e8e7e3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-[#e8e7e3] bg-[#fafaf9]">
              <tr>
                <TableHead>Nume</TableHead>
                <TableHead>Utilizator</TableHead>
                <TableHead>Rol curent</TableHead>
                <TableHead>Stare</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead align="right">Acțiuni</TableHead>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="motion-table-row border-t border-[#efeeeb] align-middle hover:bg-[#f6f6f4]"
                >
                  <TableCell className="font-semibold text-[#1b1a17]">
                    {formatText(user.name)}
                  </TableCell>
                  <TableCell className="text-[#6f6b63]">
                    <span className="font-mono">{formatText(user.username)}</span>
                  </TableCell>
                  <TableCell>{formatRole(user.role)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.active
                          ? "bg-[#f0fdf4] text-[#166534]"
                          : "bg-[#fef2f2] text-[#b91c1c]"
                      }`}
                    >
                      {user.active ? "Activ" : "Dezactivat"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.twoFactorStatus === "ACTIVE"
                          ? "bg-[#f0fdf4] text-[#166534]"
                          : user.twoFactorStatus === "PENDING"
                            ? "bg-[#fff7ed] text-[#9a3412]"
                            : user.twoFactorStatus === "CODE_ISSUED"
                              ? "bg-[#eff6ff] text-[#1d4ed8]"
                            : "bg-[#f5f5f4] text-[#57534e]"
                      }`}
                    >
                      {user.twoFactorStatus === "ACTIVE"
                        ? "Activ"
                        : user.twoFactorStatus === "PENDING"
                          ? "În configurare"
                          : user.twoFactorStatus === "CODE_ISSUED"
                            ? "Cod emis"
                          : "Neconfigurat"}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <RoleForm userId={user.id} currentRole={user.role} />
                      <ResetPasswordDialog
                        userId={user.id}
                        username={user.username ?? user.name ?? user.id}
                      />
                      {user.id !== currentUserId &&
                      user.twoFactorStatus === "ACTIVE" &&
                      user.username ? (
                        <ResetTwoFactorDialog userId={user.id} username={user.username} />
                      ) : null}
                      {user.id !== currentUserId &&
                      user.active &&
                      user.twoFactorStatus !== "ACTIVE" &&
                      user.username ? (
                        <IssueTwoFactorActivationDialog
                          userId={user.id}
                          username={user.username}
                        />
                      ) : null}
                      {user.id !== currentUserId ? (
                        <StaffActiveButton
                          userId={user.id}
                          active={user.active}
                          label={user.username ?? user.name ?? user.id}
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
          <div className="px-4 py-12 text-center text-sm text-[#6f6b63]">
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
    email: partner.email ?? "",
    address: partner.address ?? "",
    idno: partner.idno ?? "",
    vatCode: partner.vatCode ?? "",
    iban: partner.iban ?? "",
    bankName: partner.bankName ?? "",
    bankCode: partner.bankCode ?? "",
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
      className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98948b] ${
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
      className={`px-4 py-3 ${
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

function toWarehouseOptions(warehouses: OperationsData["warehouses"]): WarehouseOption[] {
  return warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name }));
}

function toSupplierOptions(suppliers: OperationsData["suppliers"]): SupplierOption[] {
  return suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }));
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

function formatFormValue(value: { toString(): string } | number | null | undefined) {
  return value === null || value === undefined ? "" : value.toString();
}
