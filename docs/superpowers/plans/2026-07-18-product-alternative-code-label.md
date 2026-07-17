# Product Alternative Code Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save one optional alternative supplier code per product and print it as `PRIMARY / ALTERNATIVE` on every sticker format.

**Architecture:** Add a nullable `alternativeCode` field to Prisma `Product`, pass it through the existing catalog form/action/audit flow, and use one pure label formatter from both the HTML and PDF sticker renderers. Existing products remain unchanged because the field is nullable.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7, Node test runner, PDFKit.

## Global Constraints

- The alternative code is optional and blank input is stored as `null`.
- The separator is exactly ` / ` and appears only when both codes are non-empty.
- Stickers without an alternative code keep their current primary-code output.
- Both HTML print and exported PDF stickers use the same formatter.
- Preserve all unrelated user changes in the dirty worktree.

---

### Task 1: Label code formatter

**Files:**
- Modify: `src/lib/labels/format.ts`
- Test: `src/lib/labels/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: `upperLabelText(value: string | null | undefined): string`
- Produces: `buildProductCodeLabel(primaryCode: string | null | undefined, alternativeCode: string | null | undefined): string`

- [ ] **Step 1: Write the failing formatter tests**

Import `buildProductCodeLabel` in the label test and add:

```ts
assert.equal(buildProductCodeLabel("p12013 1", "supplier 42"), "P12013 1 / SUPPLIER 42");
assert.equal(buildProductCodeLabel("p12013 1", null), "P12013 1");
assert.equal(buildProductCodeLabel(" ", "supplier 42"), "SUPPLIER 42");
assert.equal(buildProductCodeLabel(null, null), "-");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --env-file=.env --test src/lib/labels/__tests__/layout.test.ts`

Expected: FAIL because `buildProductCodeLabel` is not exported.

- [ ] **Step 3: Implement the minimal formatter**

Add to `src/lib/labels/format.ts`:

```ts
export function buildProductCodeLabel(
  primaryCode: string | null | undefined,
  alternativeCode: string | null | undefined,
) {
  const codes = [primaryCode, alternativeCode]
    .map(upperLabelText)
    .filter(Boolean);

  return codes.join(" / ") || "-";
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec tsx --env-file=.env --test src/lib/labels/__tests__/layout.test.ts`

Expected: PASS with `label layout tests passed`.

---

### Task 2: Persistence, editing, audit, and both sticker renderers

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/catalog/product-form-dialog.tsx`
- Modify: `src/app/catalog/actions.ts`
- Modify: `src/app/crm/page.tsx`
- Modify: `src/app/print/labels/page.tsx`
- Modify: `src/app/api/export/labels/route.ts`
- Modify (generated): `src/generated/prisma/**`
- Create: `src/app/catalog/__tests__/alternative-code-integration.test.ts`

**Interfaces:**
- Consumes: `buildProductCodeLabel(primaryCode, alternativeCode)` from Task 1
- Produces: nullable Prisma field `Product.alternativeCode` and form field `alternativeCode`

- [ ] **Step 1: Write the failing integration invariant test**

Create a source-level integration test that reads the files above and asserts:

```ts
assert.match(schema, /alternativeCode\s+String\?/);
assert.match(form, /name="alternativeCode"/);
assert.match(actions, /alternativeCode: input\.alternativeCode/g);
assert.match(actions, /const alternativeCode = readString\(formData, "alternativeCode"\) \|\| null;/);
assert.match(crmPage, /alternativeCode: product\.alternativeCode \?\? ""/);
assert.match(htmlLabels, /buildProductCodeLabel\(product\.externalCode, product\.alternativeCode\)/);
assert.match(pdfLabels, /buildProductCodeLabel\(product\.externalCode, product\.alternativeCode\)/);
```

- [ ] **Step 2: Run the integration test and verify RED**

Run: `pnpm exec tsx --env-file=.env --test src/app/catalog/__tests__/alternative-code-integration.test.ts`

Expected: FAIL because the Prisma field and form/action/renderer wiring do not exist.

- [ ] **Step 3: Add the Prisma field and regenerate the client**

Add `alternativeCode String?` beside `externalCode` in `Product`, then run:

```bash
pnpm prisma:generate
```

Expected: Prisma client generation exits 0 and generated `Product` types include `alternativeCode`.

- [ ] **Step 4: Wire create/edit and audit persistence**

Add `alternativeCode` to `ProductFormValue` and a „Cod alternativ” input beside the primary code. In `parseProductForm`, normalize it with:

```ts
const alternativeCode = readString(formData, "alternativeCode") || null;
```

Return it, persist it in both `product.create` and `product.update`, and include it in `productAuditSnapshot` input/output.

- [ ] **Step 5: Populate edit values from the CRM product**

Add to `toProductFormValue(product)`:

```ts
alternativeCode: product.alternativeCode ?? "",
```

- [ ] **Step 6: Use the shared formatter in HTML and PDF labels**

Import `buildProductCodeLabel` in both sticker renderers and replace the current primary-only formatting with:

```ts
const code = buildProductCodeLabel(product.externalCode, product.alternativeCode);
```

and in PDF:

```ts
const codeText = buildProductCodeLabel(product.externalCode, product.alternativeCode);
```

- [ ] **Step 7: Run the focused tests and verify GREEN**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/labels/__tests__/layout.test.ts src/app/catalog/__tests__/alternative-code-integration.test.ts
```

Expected: both tests pass.

- [ ] **Step 8: Verify schema, generated types, full tests, lint, and build**

Run:

```bash
pnpm exec prisma validate
pnpm test
pnpm lint
pnpm build
```

Expected: all commands exit 0. If an unrelated pre-existing failure appears, record the exact command and error without changing unrelated code.

- [ ] **Step 9: Review only task-related diffs**

Run `git diff --check` and inspect the diffs for the files listed in this task. Confirm the worktree's unrelated modifications are preserved.
