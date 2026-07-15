# Product Warehouse Stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow every product to have independent stock in each warehouse while keeping the product total synchronized and supporting both direct editing and stock operations.

**Architecture:** Reuse `WarehouseStock` as the per-warehouse source of truth. Keep `Product.stock` as a denormalized sum for existing catalog, reports, exports, search, and vitrina consumers. Parse repeated warehouse fields in a pure catalog helper, save them transactionally, and migrate legacy unassigned stock to Pavilion 110A.

**Tech Stack:** Next.js 16 Server Actions, React 19, TypeScript, Prisma 7, PostgreSQL, Node `assert` tests run with `pnpm tsx`.

## Global Constraints

- Existing legacy stock without warehouse rows moves to `Pavilion 110A`.
- `WarehouseStock` remains unique by `[productId, warehouseId]`.
- `Product.stock` always equals the sum of all persisted warehouse rows after a stock change.
- Only active warehouses are editable from the product form; inactive rows remain in totals.
- Empty warehouse quantities mean zero; negative, fractional, non-numeric, duplicate, unknown, or inactive assignments are rejected.
- Existing receipt, sale, return, transfer, inventory, document edit/delete, minimum-stock, export, and vitrina behavior remains compatible.

---

### Task 1: Warehouse stock assignment parsing

**Files:**
- Create: `src/lib/catalog/warehouse-stock.ts`
- Create: `src/lib/catalog/__tests__/warehouse-stock.test.ts`

**Interfaces:**
- Consumes repeated form fields `{ warehouseIds: string[]; quantities: string[] }` and active warehouses `{ id: string }[]`.
- Produces `parseWarehouseStockAssignments(input, activeWarehouses): WarehouseStockAssignment[]` with `{ warehouseId: string; quantity: number }` for every active warehouse.

- [ ] **Step 1: Write the failing tests**

  Cover valid mapping, blank-to-zero, and rejection of negative, fractional, non-numeric, duplicate, unknown, inactive, missing, and mismatched assignments. Use Node `assert` and call the parser directly.

  The first test must import `parseWarehouseStockAssignments` from `@/lib/catalog/warehouse-stock` and assert:

  ```ts
  assert.deepEqual(
    parseWarehouseStockAssignments(
      { warehouseIds: ["110a", "514"], quantities: ["2", "4"] },
      [{ id: "110a" }, { id: "514" }],
    ),
    [
      { warehouseId: "110a", quantity: 2 },
      { warehouseId: "514", quantity: 4 },
    ],
  );
  ```

- [ ] **Step 2: Run the parser test to verify RED**

  Run `pnpm tsx src/lib/catalog/__tests__/warehouse-stock.test.ts`.

  Expected result: module/function-not-found failure because the helper does not yet exist.

- [ ] **Step 3: Implement the minimal parser**

  Define:

  ```ts
  export type WarehouseStockAssignment = { warehouseId: string; quantity: number };
  export function parseWarehouseStockAssignments(
    input: { warehouseIds: string[]; quantities: string[] },
    activeWarehouses: Array<{ id: string }>,
  ): WarehouseStockAssignment[];
  ```

  Trim ids, require exactly one value for every active warehouse, map an empty quantity to 0, accept only integer quantities `>= 0`, reject duplicate/unknown/inactive ids, and return assignments in active warehouse order. Use concise Romanian errors consistent with the existing server actions.

- [ ] **Step 4: Run the parser test to verify GREEN**

  Run `pnpm tsx src/lib/catalog/__tests__/warehouse-stock.test.ts`.

  Expected result: `warehouse stock tests passed` and exit code 0.

- [ ] **Step 5: Commit the parser**

  ```bash
  git add src/lib/catalog/warehouse-stock.ts src/lib/catalog/__tests__/warehouse-stock.test.ts
  git commit -m "feat: validate warehouse stock assignments"
  ```

### Task 2: Migrate legacy stock to Pavilion 110A

**Files:**
- Create: `scripts/migrate-product-warehouse-stock.ts`
- Modify: `package.json` to add `stock:migrate`.

**Interfaces:**
- Produces an idempotent command `pnpm stock:migrate` that ensures `Pavilion 110A`, creates missing product rows there from `Product.stock`, and synchronizes totals for products that already have warehouse rows.

- [ ] **Step 1: Write the migration behavior testable as pure helpers**

  Add `src/lib/catalog/__tests__/warehouse-stock-migration.test.ts` covering: legacy quantity 7 with no rows maps to 110A quantity 7; a product with existing rows preserves them and total becomes their sum; a second migration plan produces no duplicate create.

- [ ] **Step 2: Run the migration helper test to verify RED**

  Run `pnpm tsx src/lib/catalog/__tests__/warehouse-stock-migration.test.ts` and confirm it fails because the migration helper is absent.

- [ ] **Step 3: Implement idempotent migration planning and command**

  Add a pure helper with an explicit return shape such as:

  ```ts
  type ExistingStockRow = { warehouseId: string; quantity: number };
  type ProductStockMigration = {
    productId: string;
    legacyStock: number;
    existingRows: ExistingStockRow[];
    warehouse110AId: string;
  };
  export function planProductWarehouseMigration(input: ProductStockMigration): {
    create110AQuantity: number | null;
    totalQuantity: number;
  };
  ```

  The script must use Prisma in one transaction: upsert 110A, load products with warehouse rows, create 110A only when a product has no rows, and update `Product.stock` to the sum of rows. Never add legacy stock to an already distributed product. Log migrated and synchronized counts.

- [ ] **Step 4: Run migration tests and type-check**

  Run `pnpm tsx src/lib/catalog/__tests__/warehouse-stock-migration.test.ts` and `pnpm exec tsc --noEmit`.

  Expected result: tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the migration**

  ```bash
  git add scripts/migrate-product-warehouse-stock.ts src/lib/catalog/__tests__/warehouse-stock-migration.test.ts package.json
  git commit -m "feat: migrate legacy stock to warehouse 110A"
  ```

### Task 3: Persist per-warehouse quantities from the product form

**Files:**
- Modify: `src/app/catalog/actions.ts`

**Interfaces:**
- Consumes `parseWarehouseStockAssignments` and repeated `warehouseId`/`warehouseQuantity` fields.
- Produces create/update actions that save product data and warehouse rows in one Prisma transaction and synchronize `Product.stock`.

- [ ] **Step 1: Add action-level failing coverage for the pure stock-save calculation**

  Extend the warehouse stock tests with the expected total helper behavior: assignments `[2, 4]` plus preserved inactive row `1` produce total `7`. Keep the test independent of a live database.

- [ ] **Step 2: Run the test to verify RED**

  Run `pnpm tsx src/lib/catalog/__tests__/warehouse-stock.test.ts` and confirm the new total assertion fails before the helper exists.

- [ ] **Step 3: Implement transactional persistence**

  In `src/app/catalog/actions.ts`:

  - load active warehouses before mutation and parse the form assignments;
  - remove editable aggregate `stock` parsing while keeping `minStock` unchanged;
  - on create, create the product with `stock: 0`, then upsert all active warehouse rows;
  - on update, upsert every active assignment, preserve inactive rows, sum all rows, and update `Product.stock` to that sum;
  - wrap product mutation and warehouse persistence in one `prisma.$transaction`;
  - include warehouse quantities in audit before/after snapshots;
  - delete `reconcileManualStock`, since the form now submits the full distribution;
  - keep price, fitment, type, and product validation behavior unchanged.

  Use `warehouseId` and `warehouseQuantity` repeated fields, and ensure no direct product save can leave a total different from persisted warehouse rows.

- [ ] **Step 4: Run tests and type-check**

  Run `pnpm tsx src/lib/catalog/__tests__/warehouse-stock.test.ts` and `pnpm exec tsc --noEmit`.

  Expected result: all warehouse stock tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit transactional persistence**

  ```bash
  git add src/app/catalog/actions.ts src/lib/catalog/warehouse-stock.ts src/lib/catalog/__tests__/warehouse-stock.test.ts
  git commit -m "feat: save product stock per warehouse"
  ```

### Task 4: Expose warehouse data in catalog and product drawer

**Files:**
- Modify: `src/lib/catalog/queries.ts`
- Modify: `src/app/catalog/product-form-dialog.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `getCatalogData` returns active `warehouses: { id: string; name: string; isDefault: boolean }[]`.
- `ProductFormDialog` receives `warehouses` and `product.warehouseStocks: { warehouseId: string; quantity: string }[]`.

- [ ] **Step 1: Query active warehouses and current product assignments**

  Query active warehouses ordered by default first then name. Include product warehouse rows with `warehouseId`, `quantity`, and warehouse name; do not hide zero rows needed by the editor. Keep catalog pagination and existing filters unchanged, except `onlyInStock` continues to use the synchronized total.

- [ ] **Step 2: Pass warehouse options to create and edit dialogs**

  Update the catalog header action and `ProductRow` in `src/app/page.tsx` to pass active warehouse options. Update `toProductFormValue` to map current rows by warehouse id and default missing active rows to `"0"`.

- [ ] **Step 3: Replace the editable global stock field**

  In `ProductFormDialog`, render one numeric field per active warehouse with paired hidden `warehouseId` and `warehouseQuantity` names. Display a controlled read-only total as the sum of the fields. Reset local values when opening the dialog. Keep `minStock` separate.

- [ ] **Step 4: Display total and warehouse breakdown in the catalog**

  Keep the main stock value as the synchronized product total and display each active warehouse quantity below it, with readable names. Include zero values where a warehouse is active so the distribution is unambiguous.

- [ ] **Step 5: Run type-check and lint**

  Run `pnpm exec tsc --noEmit` and `pnpm lint`.

  Expected result: both commands exit 0.

- [ ] **Step 6: Commit the catalog UI**

  ```bash
  git add src/lib/catalog/queries.ts src/app/catalog/product-form-dialog.tsx src/app/page.tsx
  git commit -m "feat: edit and display warehouse stock in catalog"
  ```

### Task 5: Verify all stock consumers and regressions

**Files:**
- Verify: `src/app/operations/actions.ts`, `src/app/operations/document-actions.ts`, `src/app/istoric/actions.ts`, `src/app/payment-accounts/actions.ts`, `src/lib/reports/queries.ts`, `src/lib/vitrina/queries.ts`, `src/app/api/export/products/route.ts`.
- Modify only if a consumer still reads a stale unsynchronized value or fails to resync after a warehouse update.

**Interfaces:**
- All movement paths continue to update the selected `WarehouseStock` row and synchronize `Product.stock`.

- [ ] **Step 1: Search every stock mutation and aggregation**

  Run `rg -n "warehouseStock|WarehouseStock|product\.stock|data: \{ stock|syncProduct" src` and trace each mutation to its transaction.

- [ ] **Step 2: Add focused regression tests where a path lacks synchronization**

  Use existing test patterns under `src/lib/**/__tests__`; do not create a live database dependency. If all paths already synchronize, record that no production change is needed.

- [ ] **Step 3: Run every standalone repository test**

  Run:

  ```bash
  for test in $(rg --files src -g '*__tests__/*.test.ts'); do
    pnpm tsx "$test" || exit 1
  done
  ```

  Expected result: every test exits 0.

### Task 6: Final verification and handoff

**Files:**
- Verify all changed files and repository state.

- [ ] **Step 1: Run the complete verification suite**

  Run `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build`.

  Expected result: all commands exit 0 with no TypeScript or lint errors and a successful Next.js production build.

- [ ] **Step 2: Check the diff**

  Run `git diff --check` and `git status --short`; verify no generated artifacts or unrelated files changed.

- [ ] **Step 3: Run the migration command only when database connectivity is available**

  Run `pnpm stock:migrate` against the configured database and verify its logged counts. If no database environment is available, report the command as ready but do not claim live data migration was executed.

- [ ] **Step 4: Commit any final fixes**

  ```bash
  git add <only-feature-files>
  git commit -m "test: verify per-warehouse stock workflow"
  ```
