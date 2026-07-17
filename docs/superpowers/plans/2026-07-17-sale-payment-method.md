# Sale Payment Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required Cash/Card choice to new sales, preserve it through approvals, and expose an auditable optional value for historical sales.

**Architecture:** Add an optional Prisma enum field on `StockDocument`, with a focused domain helper owning parsing and labels. Thread the required value through the existing typed pending-sale payload and `executeSale`, then mirror the existing cash-register display/update pattern in CRM details, approvals, and exports.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7/PostgreSQL, Node test runner through `tsx --test`, PDFKit, SheetJS.

## Global Constraints

- Payment method is independent from `cashRegistered`.
- New sales require exactly `CASH` or `CARD` on both client and server.
- Historical sales may keep `null`, displayed as `Nespecificat`.
- Payment method may be changed only on `SALE` documents and every change is audited.
- Payment method never changes stock, totals, VAT, returns, restock tasks, or customers.
- Existing dirty worktree changes must be preserved.

---

### Task 1: Payment-method domain and persistence

**Files:**
- Create: `src/lib/operations/sale-payment-method.ts`
- Create: `src/lib/operations/__tests__/sale-payment-method.test.ts`
- Modify: `prisma/schema.prisma`
- Regenerate: `src/generated/prisma/**`

**Interfaces:**
- Produces: `SalePaymentMethodValue = "CASH" | "CARD"`, `SalePaymentMethodStatus = SalePaymentMethodValue | null`.
- Produces: `parseRequiredSalePaymentMethod(string)`, `parseOptionalSalePaymentMethod(string)`, `salePaymentMethodLabel(status)`, `salePaymentMethodFormValue(status)`, `assertSalePaymentMethodDocumentType(string)`.

- [ ] **Step 1: Write the failing domain test**

Create assertions that `cash`/`card` parse to enum values, an empty required value throws `Alege metoda de plată: Cash sau Card.`, `unspecified` parses to `null`, labels are `Cash`, `Card`, and `Nespecificat`, and non-sale document types are rejected.

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/lib/operations/__tests__/sale-payment-method.test.ts`

Expected: FAIL because `@/lib/operations/sale-payment-method` does not exist.

- [ ] **Step 3: Add the enum field and minimal helper**

Add to Prisma:

```prisma
enum SalePaymentMethod {
  CASH
  CARD
}

model StockDocument {
  // existing fields
  /// SALE: CASH/CARD; null = vânzare istorică sau nespecificată.
  paymentMethod SalePaymentMethod?
}
```

Implement the helper with exact mappings `cash -> CASH`, `card -> CARD`,
`unspecified -> null`; reject everything else with the messages from Step 1.

- [ ] **Step 4: Regenerate Prisma and verify GREEN**

Run: `pnpm prisma:generate && pnpm test src/lib/operations/__tests__/sale-payment-method.test.ts`

Expected: Prisma generation succeeds and the focused test passes.

- [ ] **Step 5: Commit the domain slice**

```bash
git add prisma/schema.prisma src/generated/prisma src/lib/operations/sale-payment-method.ts src/lib/operations/__tests__/sale-payment-method.test.ts
git commit -m "feat: add sale payment method domain"
```

---

### Task 2: Require and persist method through direct and approved sales

**Files:**
- Modify: `src/lib/pending-operations/types.ts`
- Modify: `src/lib/pending-operations/payload.ts`
- Modify: `src/lib/pending-operations/__tests__/payload.test.ts`
- Modify: `src/lib/operations/execute-sale.ts`
- Modify: `src/lib/operations/__tests__/execute-sale.test.ts`
- Modify: `src/app/operations/actions.ts`
- Modify: `src/app/operations/stock-document-dialog.tsx`
- Modify: `src/app/aprobari/approval-workspace.tsx`
- Modify: `src/app/operations/__tests__/cash-register-form.test.ts`

**Interfaces:**
- Consumes: `SalePaymentMethodValue`, `parseRequiredSalePaymentMethod`, `salePaymentMethodLabel`.
- Produces: required `paymentMethod: SalePaymentMethodValue` on `PendingSalePayload`.

- [ ] **Step 1: Extend payload and form tests first**

Add `paymentMethod: "CARD"` to the valid pending payload and assert it survives parsing. Add a payload without `paymentMethod` and assert the exact required-method error. Extend the form source test to require `name="paymentMethod"`, `value="cash"`, and `value="card"`; extend the approval source test to require `entry.details.paymentMethod`.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm test src/lib/pending-operations/__tests__/payload.test.ts \
  src/lib/operations/__tests__/execute-sale.test.ts \
  src/app/operations/__tests__/cash-register-form.test.ts
```

Expected: FAIL because the payload, summary, form, and approval do not contain the method.

- [ ] **Step 3: Thread the typed value through creation**

Add `paymentMethod: SalePaymentMethodValue` to `PendingSalePayload`. In the payload parser require `record.paymentMethod === "CASH" || record.paymentMethod === "CARD"`; otherwise throw `Alege metoda de plată: Cash sau Card.`. In `createSaleAction`, parse the form value and include it in `parsePendingOperationPayload`.

In `executeSale`, persist:

```ts
paymentMethod: payload.paymentMethod,
```

Include it in audit details and append `plată ${salePaymentMethodLabel(payload.paymentMethod)}` to `saleRequestSummary`.

- [ ] **Step 4: Add the required form and approval display**

Place beside the cash-register selection:

```tsx
<Field label="Metoda de plată">
  <select className={inputClassName} defaultValue="" name="paymentMethod" required>
    <option value="" disabled>Alege Cash sau Card</option>
    <option value="cash">Cash</option>
    <option value="card">Card</option>
  </select>
</Field>
```

Show `salePaymentMethodLabel(entry.details.paymentMethod)` in the sale approval details.

- [ ] **Step 5: Verify GREEN**

Run the three focused test files from Step 2 and `pnpm exec tsc --noEmit`.

Expected: all focused tests and TypeScript pass.

- [ ] **Step 6: Commit the sale flow slice**

```bash
git add src/lib/pending-operations src/lib/operations/execute-sale.ts src/lib/operations/__tests__/execute-sale.test.ts src/app/operations/actions.ts src/app/operations/stock-document-dialog.tsx src/app/aprobari/approval-workspace.tsx src/app/operations/__tests__/cash-register-form.test.ts
git commit -m "feat: require payment method on sales"
```

---

### Task 3: Display, edit, and audit the method

**Files:**
- Create: `src/app/operations/sale-payment-method-control.tsx`
- Create: `src/app/operations/__tests__/sale-payment-method-display.test.ts`
- Create: `src/app/operations/__tests__/sale-payment-method-update-invariants.test.ts`
- Modify: `src/app/operations/document-actions.ts`
- Modify: `src/app/operations/document-details.tsx`
- Modify: `src/app/crm/page.tsx`

**Interfaces:**
- Consumes: all Task 1 helpers.
- Produces: `updateSalePaymentMethodAction`, `SalePaymentMethodBadge`, and `SalePaymentMethodControl`.

- [ ] **Step 1: Write failing source-invariant tests**

Require the CRM lists and details serializer to read `paymentMethod`; require the details drawer to label it `Metoda de plată`. Require the update action to assert `SALE`, update only `{ paymentMethod }`, include before/after values in audit, and revalidate `/crm`.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm test src/app/operations/__tests__/sale-payment-method-display.test.ts \
  src/app/operations/__tests__/sale-payment-method-update-invariants.test.ts
```

Expected: FAIL because display/control/action symbols do not exist.

- [ ] **Step 3: Add update action and focused control**

Mirror `updateCashRegisteredAction`: require the same modifying role, select only `id`, `type`, `number`, and `paymentMethod`, reject non-sales, no-op on equality, update only `paymentMethod`, audit old/new labels and raw values, then revalidate `/crm`.

The new client component must render a badge with `Cash`, `Card`, or `Nespecificat` and a select with `cash`, `card`, and `unspecified` plus a compact save button.

- [ ] **Step 4: Wire every CRM view and details drawer**

Add `paymentMethod` to `DocumentDetailsValue` and `toDocumentDetails`. Render the label only when `isSale`. Add a `Plată` table column beside `Casă` in sales archive, recent documents, and the document list. Render badge plus editor for users who can modify sales; render `—` for non-sales.

- [ ] **Step 5: Verify GREEN**

Run the two focused tests and `pnpm exec tsc --noEmit`.

Expected: focused tests and TypeScript pass.

- [ ] **Step 6: Commit the CRM slice**

```bash
git add src/app/operations/document-actions.ts src/app/operations/document-details.tsx src/app/operations/sale-payment-method-control.tsx src/app/operations/__tests__/sale-payment-method-display.test.ts src/app/operations/__tests__/sale-payment-method-update-invariants.test.ts src/app/crm/page.tsx
git commit -m "feat: show and edit sale payment method"
```

---

### Task 4: Include method in exports and verify the feature

**Files:**
- Create: `src/app/operations/__tests__/sale-payment-method-exports.test.ts`
- Modify: `src/app/api/export/sales-register/route.ts`
- Modify: `src/app/api/export/document/[id]/pdf/route.ts`
- Modify: `src/app/api/export/invoice/[id]/route.ts`

**Interfaces:**
- Consumes: `salePaymentMethodLabel`.
- Produces: payment-method columns/metadata on sale exports; non-sale exports remain unchanged.

- [ ] **Step 1: Write a failing export source test**

Require all three routes to reference `salePaymentMethodLabel`; require the sales register row model and both PDF/XLSX paths to include `paymentMethod`.

- [ ] **Step 2: Verify RED**

Run: `pnpm test src/app/operations/__tests__/sale-payment-method-exports.test.ts`

Expected: FAIL because exports do not include the method.

- [ ] **Step 3: Add export metadata/columns**

For the sales register, add `paymentMethod` to each row and place a `Metoda plății` column after `Document` in XLSX and `Plată` after `Document` in PDF. Returns use `Nespecificat`; sales use `salePaymentMethodLabel(doc.paymentMethod)`.

For single-document PDF/XLSX exports, append `Metoda de plată: <label>` only when `document.type === "SALE"`.

- [ ] **Step 4: Verify focused and full checks**

Run:

```bash
pnpm test src/lib/operations/__tests__/sale-payment-method.test.ts \
  src/lib/pending-operations/__tests__/payload.test.ts \
  src/lib/operations/__tests__/execute-sale.test.ts \
  src/app/operations/__tests__/cash-register-form.test.ts \
  src/app/operations/__tests__/sale-payment-method-display.test.ts \
  src/app/operations/__tests__/sale-payment-method-update-invariants.test.ts \
  src/app/operations/__tests__/sale-payment-method-exports.test.ts
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Expected: all commands exit 0 with no test failures, type errors, lint errors, or build errors.

- [ ] **Step 5: Review the final diff and schema deployment requirement**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~3
```

Confirm no unrelated user changes were staged or overwritten. Record that the deployment environment must run `pnpm db:push` before serving code generated for the new column; do not run it automatically against an unknown configured database.

- [ ] **Step 6: Commit the export slice**

```bash
git add src/app/api/export/sales-register/route.ts 'src/app/api/export/document/[id]/pdf/route.ts' 'src/app/api/export/invoice/[id]/route.ts' src/app/operations/__tests__/sale-payment-method-exports.test.ts
git commit -m "feat: export sale payment methods"
```
