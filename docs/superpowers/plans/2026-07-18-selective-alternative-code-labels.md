# Selective Alternative Code Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-product, default-off checkbox in the sticker quantity panel that controls whether HTML and PDF stickers include the saved alternative code.

**Architecture:** Extend the existing session-stored label selection with alternative-code metadata and a boolean choice. Keep `items=id:count` unchanged and transport enabled product IDs in a backward-compatible `alt=id1,id2` query parameter that both renderers and the print controls preserve.

**Tech Stack:** React 19, Next.js 16, TypeScript, Node test runner, PDFKit.

## Global Constraints

- The checkbox is per product and defaults to `false`.
- Products without an alternative code cannot enable the option.
- Existing session selections migrate without losing IDs or quantities.
- Existing print links without `alt` render only the primary code.
- HTML print and PDF export must behave identically.
- Preserve all unrelated changes in the dirty worktree; do not stage shared files wholesale.

---

### Task 1: Selection state and print query

**Files:**
- Modify: `src/app/catalog/label-selection.ts`
- Test: `src/app/catalog/__tests__/label-selection.test.ts`

**Interfaces:**
- Produces: `LabelSelectionItem.alternativeCode: string`
- Produces: `LabelSelectionItem.includeAlternativeCode: boolean`
- Produces: `setLabelAlternativeCode(items, id, include): LabelSelectionItem[]`
- Produces: `buildLabelPrintQuery(items)` with optional `alt`

- [ ] **Step 1: Write failing tests for defaults, toggling, and query output**

Update expected legacy items with `alternativeCode: ""` and `includeAlternativeCode: false`, then add:

```ts
test("enables the alternative code only for products that have one", () => {
  const withAlternative = {
    id: "p1", code: "A", alternativeCode: "SUP-A", name: "Aripă",
    compatibility: "", count: 1, includeAlternativeCode: false,
  };
  assert.equal(setLabelAlternativeCode([withAlternative], "p1", true)[0]?.includeAlternativeCode, true);
  assert.equal(
    setLabelAlternativeCode([{ ...withAlternative, alternativeCode: "" }], "p1", true)[0]?.includeAlternativeCode,
    false,
  );
});

test("prints alternative codes only for explicitly enabled products", () => {
  const items = [
    { id: "p1", code: "A", alternativeCode: "SUP-A", name: "Aripă", compatibility: "", count: 2, includeAlternativeCode: true },
    { id: "p2", code: "B", alternativeCode: "SUP-B", name: "Bară", compatibility: "", count: 1, includeAlternativeCode: false },
  ];
  assert.equal(buildLabelPrintQuery(items).get("items"), "p1:2,p2:1");
  assert.equal(buildLabelPrintQuery(items).get("alt"), "p1");
  assert.equal(buildLabelPrintQuery(items.map((item) => ({ ...item, includeAlternativeCode: false }))).has("alt"), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --env-file=.env --test src/app/catalog/__tests__/label-selection.test.ts`

Expected: FAIL because the new state and setter do not exist.

- [ ] **Step 3: Implement backward-compatible state handling**

Add both fields to `LabelSelectionItem`. Parse missing stored values as `""` and `false`; force `includeAlternativeCode` to `false` when no alternative code exists. Preserve the user's boolean during hydration while refreshing the alternative-code metadata.

Implement:

```ts
export function setLabelAlternativeCode(items: LabelSelectionItem[], id: string, include: boolean) {
  return items.map((item) =>
    item.id === id
      ? { ...item, includeAlternativeCode: Boolean(include && item.alternativeCode.trim()) }
      : item,
  );
}
```

Set `alt` in `buildLabelPrintQuery` only when enabled IDs exist.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec tsx --env-file=.env --test src/app/catalog/__tests__/label-selection.test.ts`

Expected: all selection tests pass.

---

### Task 2: Quantity-panel checkbox and renderer propagation

**Files:**
- Modify: `src/app/crm/page.tsx`
- Modify: `src/app/catalog/label-picker.tsx`
- Modify: `src/app/print/labels/page.tsx`
- Modify: `src/app/print/labels/label-controls.tsx`
- Modify: `src/app/api/export/labels/route.ts`
- Test: `src/app/catalog/__tests__/alternative-code-integration.test.ts`

**Interfaces:**
- Consumes: `alt=id1,id2` from Task 1
- Produces: checkbox labeled „Include cod alternativ” in the quantity panel
- Produces: conditional `buildProductCodeLabel(primary, enabled ? alternative : null)` in HTML and PDF

- [ ] **Step 1: Add failing source-integration assertions**

Assert that the CRM row exposes `data-label-alternative-code`, the picker renders „Include cod alternativ”, and both renderers conditionally pass the alternative code based on `includeAlternativeCode`. Assert that `LabelControls` includes `includeAlternativeCode` in its items and forwards an `alt` parameter to PDF/navigation URLs.

- [ ] **Step 2: Run the integration test and verify RED**

Run: `pnpm exec tsx --env-file=.env --test src/app/catalog/__tests__/alternative-code-integration.test.ts`

Expected: FAIL because the checkbox and conditional renderer propagation are absent.

- [ ] **Step 3: Expose and hydrate alternative-code metadata**

Add `data-label-alternative-code={product.alternativeCode ?? ""}` to the CRM selection checkbox. Read it in both picker hydration paths with `includeAlternativeCode: false` for newly selected products.

- [ ] **Step 4: Add the per-product checkbox**

Use `setLabelAlternativeCode` to persist changes. Render a controlled checkbox in each selected-product row:

```tsx
<input
  type="checkbox"
  checked={item.includeAlternativeCode}
  disabled={!item.alternativeCode}
  onChange={(event) => updateAlternativeCode(item.id, event.currentTarget.checked)}
/>
```

Label it „Include cod alternativ”; show „Fără cod alternativ” when disabled.

- [ ] **Step 5: Parse and preserve `alt` on the print page**

Parse `params.alt` into a `Set<string>`, add `includeAlternativeCode` to each label slot and `LabelControls` item, and preserve enabled IDs when navigating or building the PDF URL.

- [ ] **Step 6: Apply the selection in HTML and PDF**

Use:

```ts
buildProductCodeLabel(
  product.externalCode,
  includeAlternativeCode ? product.alternativeCode : null,
)
```

in both renderers. Links without `alt` therefore retain primary-only output.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/app/catalog/__tests__/label-selection.test.ts src/app/catalog/__tests__/alternative-code-integration.test.ts src/lib/labels/__tests__/layout.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 8: Verify lint, build, and task diff**

Run focused ESLint on the modified TypeScript files, `pnpm build`, and `git diff --check` restricted to task files. Record unrelated baseline failures separately.
