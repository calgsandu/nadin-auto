# Label Quantity Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an automatically expanded, collapsible quantity editor to the catalog's floating sticker-selection bar and pass those quantities to the existing print preview.

**Architecture:** Keep `LabelPicker` as the client-side owner of the selection, but replace its `Set<string>` with typed selection items stored in `sessionStorage`. Put parsing, migration, clamping, and URL serialization in a small pure module so behavior can be unit-tested without a DOM; enrich the existing server-rendered checkboxes with product metadata for the panel.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Lucide React, Node test runner with `tsx`.

## Global Constraints

- The panel opens automatically when the first product is selected and can be collapsed downward manually.
- Each product starts at 1 sticker and is limited to an integer from 1 through 50.
- Selection, metadata, and quantities persist in `sessionStorage` through pagination and reloads.
- Existing string-array session data remains readable.
- Print preview receives `items=id:count` and `layout=grid`.
- The floating panel is hidden in print media and remains usable on narrow screens.

---

### Task 1: Typed selection state and persistence

**Files:**
- Create: `src/app/catalog/label-selection.ts`
- Create: `src/app/catalog/__tests__/label-selection.test.ts`

**Interfaces:**
- Produces: `LabelSelectionItem`, `clampLabelCount`, `parseLabelSelection`, `serializeLabelSelection`, `setLabelCount`, and `buildLabelPrintQuery`.
- Consumes: JSON strings from `sessionStorage` and selected items from `LabelPicker`.

- [ ] **Step 1: Write failing tests for new, legacy, invalid, clamped, and URL cases**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLabelPrintQuery,
  parseLabelSelection,
  serializeLabelSelection,
  setLabelCount,
} from "../label-selection";

test("parses stored selection items and clamps their counts", () => {
  assert.deepEqual(
    parseLabelSelection('[{"id":"p1","code":"A","name":"Aripă","count":70}]'),
    [{ id: "p1", code: "A", name: "Aripă", count: 50 }],
  );
});

test("migrates legacy id arrays with one copy", () => {
  assert.deepEqual(parseLabelSelection('["p1","p2"]'), [
    { id: "p1", code: "", name: "", count: 1 },
    { id: "p2", code: "", name: "", count: 1 },
  ]);
});

test("ignores invalid storage", () => {
  assert.deepEqual(parseLabelSelection("not-json"), []);
});

test("updates one quantity without changing selection order", () => {
  const items = [
    { id: "p1", code: "A", name: "Aripă", count: 1 },
    { id: "p2", code: "B", name: "Bară", count: 2 },
  ];
  assert.deepEqual(setLabelCount(items, "p1", 3), [
    { ...items[0], count: 3 },
    items[1],
  ]);
});

test("serializes selection and builds the print query", () => {
  const items = [{ id: "p1", code: "A", name: "Aripă", count: 3 }];
  assert.equal(parseLabelSelection(serializeLabelSelection(items))[0]?.count, 3);
  assert.equal(buildLabelPrintQuery(items).get("items"), "p1:3");
  assert.equal(buildLabelPrintQuery(items).get("layout"), "grid");
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `pnpm exec tsx --test src/app/catalog/__tests__/label-selection.test.ts`

Expected: FAIL because `../label-selection` does not exist.

- [ ] **Step 3: Implement the pure selection helpers**

```ts
export const MIN_LABEL_COUNT = 1;
export const MAX_LABEL_COUNT = 50;

export type LabelSelectionItem = {
  id: string;
  code: string;
  name: string;
  count: number;
};

export function clampLabelCount(value: number) {
  return Math.min(Math.max(Math.round(value) || MIN_LABEL_COUNT, MIN_LABEL_COUNT), MAX_LABEL_COUNT);
}

export function parseLabelSelection(value: string | null): LabelSelectionItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const byId = new Map<string, LabelSelectionItem>();
    for (const entry of parsed) {
      const item = typeof entry === "string"
        ? { id: entry, code: "", name: "", count: 1 }
        : entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string"
          ? {
              id: (entry as { id: string }).id,
              code: typeof (entry as { code?: unknown }).code === "string" ? (entry as { code: string }).code : "",
              name: typeof (entry as { name?: unknown }).name === "string" ? (entry as { name: string }).name : "",
              count: clampLabelCount(Number((entry as { count?: unknown }).count)),
            }
          : null;
      if (item?.id.trim()) byId.set(item.id, item);
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

export const serializeLabelSelection = (items: LabelSelectionItem[]) => JSON.stringify(items);

export function setLabelCount(items: LabelSelectionItem[], id: string, count: number) {
  return items.map((item) => item.id === id ? { ...item, count: clampLabelCount(count) } : item);
}

export function buildLabelPrintQuery(items: LabelSelectionItem[]) {
  const query = new URLSearchParams();
  query.set("items", items.map((item) => `${item.id}:${item.count}`).join(","));
  query.set("layout", "grid");
  return query;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm exec tsx --test src/app/catalog/__tests__/label-selection.test.ts`

Expected: 5 passing tests and exit code 0.

- [ ] **Step 5: Commit the helper and tests**

```bash
git add src/app/catalog/label-selection.ts src/app/catalog/__tests__/label-selection.test.ts
git commit -m "test: define sticker quantity selection state"
```

---

### Task 2: Expandable quantity panel

**Files:**
- Modify: `src/app/catalog/label-picker.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: all Task 1 exports and checkbox attributes `data-label-id`, `data-label-code`, and `data-label-name`.
- Produces: an accessible floating panel that updates stored counts and opens `/print/labels` with the generated query.

- [ ] **Step 1: Add metadata to the server-rendered product checkbox**

```tsx
<input
  type="checkbox"
  data-label-id={product.id}
  data-label-code={product.externalCode ?? "—"}
  data-label-name={product.description}
  aria-label={`Selectează ${product.description} pentru sticker`}
  className="size-4 cursor-pointer accent-[#1b1a17]"
/>
```

- [ ] **Step 2: Replace the ID set with persisted typed items**

Use `parseLabelSelection` for initial state, save every selection/count mutation through `serializeLabelSelection`, preserve item order, hydrate missing legacy metadata from visible checkboxes, and call `setExpanded(true)` when adding the first item.

```ts
const [selected, setSelected] = useState<LabelSelectionItem[]>(() => loadSelection());
const [expanded, setExpanded] = useState(true);

function commit(next: LabelSelectionItem[]) {
  setSelected(next);
  if (next.length === 0) sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, serializeLabelSelection(next));
}
```

- [ ] **Step 3: Add the upward-opening collapsible list and persistent action row**

Render a `max-w-3xl` rounded panel anchored above the bottom edge. Its animated grid row uses `grid-rows-[1fr]` when expanded and `grid-rows-[0fr]` when collapsed; the inner list uses `max-h-[min(50vh,24rem)] overflow-y-auto`. Each row contains code, description, minus/input/plus controls, and a remove button. The action row always contains the product count, a chevron toggle with `aria-expanded`, “Deselectează”, and “Printează stickere”.

- [ ] **Step 4: Pass quantities to print preview**

```ts
function print() {
  if (selected.length === 0) return;
  window.open(`/print/labels?${buildLabelPrintQuery(selected).toString()}`, "_blank", "noreferrer");
}
```

- [ ] **Step 5: Run focused tests and lint modified files**

Run: `pnpm exec tsx --test src/app/catalog/__tests__/label-selection.test.ts`

Expected: all tests pass.

Run: `pnpm exec eslint src/app/catalog/label-selection.ts src/app/catalog/__tests__/label-selection.test.ts src/app/catalog/label-picker.tsx src/app/page.tsx`

Expected: exit code 0 with no lint errors.

- [ ] **Step 6: Commit the interactive panel**

```bash
git add src/app/catalog/label-picker.tsx src/app/page.tsx
git commit -m "feat: edit sticker quantities from catalog"
```

---

### Task 3: End-to-end verification

**Files:**
- Modify only if verification exposes a defect in Task 1 or Task 2 files.

**Interfaces:**
- Consumes: completed catalog picker and existing `/print/labels` route.
- Produces: evidence that the compiled app and browser workflow meet the design.

- [ ] **Step 1: Run the full automated test suite**

Run: `pnpm exec tsx --test 'src/**/__tests__/*.test.ts'`

Expected: all existing and new tests pass.

- [ ] **Step 2: Run the production build**

Run: `pnpm build`

Expected: Next.js build completes successfully with no TypeScript or compilation errors.

- [ ] **Step 3: Verify the browser flow**

Start `pnpm dev:http`, open the products catalog, select a product, and confirm the list opens automatically. Change its count, collapse and reopen the list, select products across pagination, uncheck one, and confirm the state persists. Press “Printează stickere” and confirm the new tab URL contains each remaining product exactly once as `items=id:count` plus `layout=grid`.

- [ ] **Step 4: Inspect responsive behavior**

At a narrow viewport, confirm the panel stays inside the viewport, the list scrolls, the quantity controls and actions remain reachable, and the panel remains hidden in print media.

- [ ] **Step 5: Review the final diff**

Run: `git diff HEAD~2 --check && git status --short`

Expected: no whitespace errors and no unintended files.
