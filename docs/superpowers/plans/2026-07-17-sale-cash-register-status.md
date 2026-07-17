# Sale Cash-Register Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record, display, and safely edit whether each sale was entered into the cash register, while retaining an explicit unspecified state for historical sales.

**Architecture:** Store the status as nullable `StockDocument.cashRegistered`, where `true`, `false`, and `null` map to the three requested UI states. A small operations-domain module owns parsing, labels, and document-type validation; direct-sale and approval payloads carry a required boolean, while existing and other generated sales may remain `null`. A focused server action updates only this field in a transaction and writes a required audit record.

**Tech Stack:** Next.js 16 Server Actions, React 19, TypeScript, Prisma 7/PostgreSQL, Node test runner via `tsx --test`.

## Global Constraints

- New direct sales require an explicit `Da` or `Nu` choice.
- Historical sales remain valid and display `Nespecificat`.
- The status can be changed later among all three values.
- Only users already allowed to modify sales (`ADMIN` and `DIRECTOR`) can change an existing status.
- Employees can choose the status in a sale request; approval preserves it in the final sale.
- Status changes never alter lines, stock, totals, dates, returns, reports, invoices, or payment-account state.
- The server rejects cash-register status changes for non-`SALE` documents.
- Every status correction records old and new values in the audit log.

---

### Task 1: Add the nullable field and domain behavior

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/operations/cash-register.ts`
- Create: `src/lib/operations/__tests__/cash-register.test.ts`
- Regenerate: `src/generated/prisma/**`

**Interfaces:**
- Produces: `StockDocument.cashRegistered: boolean | null`.
- Produces: `parseRequiredCashRegistered(value)`, `parseOptionalCashRegistered(value)`, `cashRegisterLabel(value)`, and `assertCashRegisterDocumentType(type)`.

- [ ] **Step 1: Write failing domain tests**

Create `src/lib/operations/__tests__/cash-register.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  assertCashRegisterDocumentType,
  cashRegisterLabel,
  parseOptionalCashRegistered,
  parseRequiredCashRegistered,
} from "@/lib/operations/cash-register";

assert.equal(parseRequiredCashRegistered("yes"), true);
assert.equal(parseRequiredCashRegistered("no"), false);
assert.throws(() => parseRequiredCashRegistered(""), /Alege dacă vânzarea a fost bătută în casă/);
assert.equal(parseOptionalCashRegistered("yes"), true);
assert.equal(parseOptionalCashRegistered("no"), false);
assert.equal(parseOptionalCashRegistered("unspecified"), null);
assert.throws(() => parseOptionalCashRegistered("other"), /Statut de casă invalid/);
assert.equal(cashRegisterLabel(true), "Bătut în casă");
assert.equal(cashRegisterLabel(false), "Nebătut în casă");
assert.equal(cashRegisterLabel(null), "Nespecificat");
assert.doesNotThrow(() => assertCashRegisterDocumentType("SALE"));
assert.throws(() => assertCashRegisterDocumentType("RECEIPT"), /doar pentru vânzări/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test src/lib/operations/__tests__/cash-register.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add the schema field and minimal implementation**

Add to `StockDocument`:

```prisma
cashRegistered Boolean?
```

Implement strict parsing for exactly `yes`, `no`, and, only in the optional parser, `unspecified`. Return the exact Romanian labels tested above. Reject every document type except `SALE`.

- [ ] **Step 4: Regenerate and verify GREEN**

Run:

```bash
pnpm prisma:generate
pnpm test src/lib/operations/__tests__/cash-register.test.ts
pnpm exec tsc --noEmit
```

Expected: all commands pass.

- [ ] **Step 5: Commit the domain slice**

```bash
git add prisma/schema.prisma src/generated/prisma src/lib/operations/cash-register.ts src/lib/operations/__tests__/cash-register.test.ts
git commit -m "feat: model sale cash register status"
```

---

### Task 2: Carry the status through direct and approved sale creation

**Files:**
- Modify: `src/lib/pending-operations/types.ts`
- Modify: `src/lib/pending-operations/payload.ts`
- Modify: `src/lib/pending-operations/__tests__/payload.test.ts`
- Modify: `src/lib/operations/execute-sale.ts`
- Modify: `src/lib/operations/__tests__/execute-sale.test.ts`
- Modify: `src/app/operations/actions.ts`

**Interfaces:**
- Consumes: `parseRequiredCashRegistered` from Task 1.
- Produces: `PendingSalePayload.cashRegistered: boolean`.
- Produces: every `executeSale` document with the requested boolean persisted.

- [ ] **Step 1: Extend payload tests before production code**

Add `cashRegistered: true` to the valid pending sale and assert it survives parsing. Add invalid/missing cases:

```ts
assert.equal(sale.payload.cashRegistered, true);

assert.throws(
  () => parsePendingOperationPayload("SALE", {
    warehouseId: "w1",
    documentDate: "2026-07-17",
    partnerId: null,
    newCustomerName: null,
    notes: null,
    lines: [{ productId: "p1", quantity: 1, unitPriceLei: 10 }],
  }),
  /bătută în casă/i,
);
```

Extend the execute-sale helper fixture with `cashRegistered: false` and assert the request summary includes `nebătută în casă`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test src/lib/pending-operations/__tests__/payload.test.ts src/lib/operations/__tests__/execute-sale.test.ts`

Expected: FAIL because the payload has no status and summary does not include it.

- [ ] **Step 3: Parse and type the required payload field**

Add `cashRegistered: boolean` to `PendingSalePayload`. In the SALE parser accept only JSON booleans; reject missing/string values with `Alege dacă vânzarea a fost bătută în casă.`. Keep serialized pending payloads explicit so approval cannot guess a status.

- [ ] **Step 4: Propagate from form to final document**

In `createSaleAction`, parse the form value with `parseRequiredCashRegistered(readString(formData, "cashRegistered"))` and put the resulting boolean into `parsePendingOperationPayload`. In `executeSale`, include:

```ts
data: {
  type: "SALE",
  cashRegistered: payload.cashRegistered,
  // existing fields
}
```

Include the human-readable status in the request summary and audit details without changing totals or stock logic.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
pnpm test src/lib/pending-operations/__tests__/payload.test.ts src/lib/operations/__tests__/execute-sale.test.ts
pnpm exec tsc --noEmit
```

Expected: focused tests and TypeScript pass.

- [ ] **Step 6: Commit creation propagation**

```bash
git add src/lib/pending-operations/types.ts src/lib/pending-operations/payload.ts src/lib/pending-operations/__tests__/payload.test.ts src/lib/operations/execute-sale.ts src/lib/operations/__tests__/execute-sale.test.ts src/app/operations/actions.ts
git commit -m "feat: capture cash status on sales"
```

---

### Task 3: Require the choice in the sale dialog and show it in approvals

**Files:**
- Modify: `src/app/operations/stock-document-dialog.tsx`
- Modify: `src/app/aprobari/approval-workspace.tsx`
- Create: `src/app/operations/__tests__/cash-register-form.test.ts`

**Interfaces:**
- Consumes: form field `cashRegistered` expected by Task 2.
- Produces: a required `yes`/`no` selection for every new direct sale.

- [ ] **Step 1: Write a failing UI-source regression test**

Read both source files and assert the sale dialog contains `name="cashRegistered"`, an empty disabled prompt, values `yes` and `no`, and the approval workspace renders `cashRegistered` through `cashRegisterLabel`.

Run: `pnpm test src/app/operations/__tests__/cash-register-form.test.ts`

Expected: FAIL because neither UI contains the field.

- [ ] **Step 2: Add required sale selection**

Place this field beside sale date/location before the product list:

```tsx
<Field label="Bătut în casa de marcat?">
  <select className={inputClassName} name="cashRegistered" defaultValue="" required>
    <option value="" disabled>Alege Da sau Nu</option>
    <option value="yes">Da</option>
    <option value="no">Nu</option>
  </select>
</Field>
```

Because the dialog resets after successful submission, ensure a reopened dialog again starts with the empty choice.

- [ ] **Step 3: Show the requested status in approval details**

Import `cashRegisterLabel` and display `Casă: Bătut în casă` or `Casă: Nebătut în casă` in the structured SALE request summary. Do not allow reviewers to alter the employee's submitted choice during approval.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm test src/app/operations/__tests__/cash-register-form.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit the creation UI**

```bash
git add src/app/operations/stock-document-dialog.tsx src/app/aprobari/approval-workspace.tsx src/app/operations/__tests__/cash-register-form.test.ts
git commit -m "feat: require sale cash register choice"
```

---

### Task 4: Add audited status correction action

**Files:**
- Modify: `src/app/operations/document-actions.ts`
- Create: `src/app/operations/cash-register-control.tsx`
- Create: `src/app/operations/__tests__/cash-register-update-invariants.test.ts`

**Interfaces:**
- Consumes: `parseOptionalCashRegistered`, `assertCashRegisterDocumentType`, existing `requireWrite`, and `logAuditRequired`.
- Produces: `updateCashRegisteredAction(state, formData): Promise<DocumentActionState>`.
- Produces: `CashRegisterBadge` and `CashRegisterControl`.

- [ ] **Step 1: Write failing action-invariant tests**

The test reads `document-actions.ts` and asserts the new action:

- calls `requireWrite()`;
- parses only `yes`, `no`, or `unspecified`;
- loads the document inside `prisma.$transaction`;
- calls `assertCashRegisterDocumentType(doc.type)`;
- updates only `{ cashRegistered }`;
- calls `logAuditRequired` with old and new values;
- calls `revalidatePath("/crm")`.

Run: `pnpm test src/app/operations/__tests__/cash-register-update-invariants.test.ts`

Expected: FAIL because the action does not exist.

- [ ] **Step 2: Implement the transactional action**

Add an action that reads `id` and `cashRegistered`, validates authorization and the document type, then updates only the status. Use this audit shape:

```ts
details: {
  before: { cashRegistered: doc.cashRegistered },
  after: { cashRegistered },
}
```

Build the summary with the actual document and labels:

```ts
summary: `Vânzare #${doc.number}: statut casă schimbat din „${cashRegisterLabel(doc.cashRegistered)}” în „${cashRegisterLabel(cashRegistered)}”`,
```

A no-op submission returns success without an update/audit write.

- [ ] **Step 3: Implement badge and edit control**

`CashRegisterBadge` maps `true` to green, `false` to orange, and `null` to neutral. `CashRegisterControl` uses `useActionState`, a select with all three values, a pending submit button, and inline `ActionFeedback`. It receives `{ documentId, value }` and submits only those two fields.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm test src/app/operations/__tests__/cash-register-update-invariants.test.ts src/lib/operations/__tests__/cash-register.test.ts
pnpm exec tsc --noEmit
```

Expected: tests and TypeScript pass.

- [ ] **Step 5: Commit the correction flow**

```bash
git add src/app/operations/document-actions.ts src/app/operations/cash-register-control.tsx src/app/operations/__tests__/cash-register-update-invariants.test.ts
git commit -m "feat: edit sale cash register status"
```

---

### Task 5: Display status on today's sales, archive, and document list

**Files:**
- Modify: `src/lib/operations/queries.ts`
- Modify: `src/lib/documents/queries.ts`
- Modify: `src/app/crm/page.tsx`
- Modify: `src/app/operations/document-details.tsx`
- Create: `src/app/operations/__tests__/cash-register-display.test.ts`

**Interfaces:**
- Consumes: `CashRegisterBadge` and `CashRegisterControl` from Task 4.
- Produces: visible status on `salesToday`, 90-day sale archive/group data, filtered SALE documents, and sale details.

- [ ] **Step 1: Write failing display-coverage test**

Read the CRM and details source and assert:

- `RecentDocumentsTable` renders `CashRegisterBadge` for `SALE`;
- the status column is visible in `Vânzările de azi` and recent/archive sales;
- `CashRegisterControl` is rendered only when `canModify && document.type === "SALE"`;
- sale details include `Statut casă`;
- non-sale documents render `—` and no edit control.

Run: `pnpm test src/app/operations/__tests__/cash-register-display.test.ts`

Expected: FAIL because no status UI exists.

- [ ] **Step 2: Ensure query shapes include the field**

Prisma full-model queries already include scalar fields; explicitly preserve `cashRegistered` in any manual mapping/type used by operations, document queries, and `toDocumentDetails`. Do not add the field to financial aggregation SQL because it must not affect totals.

- [ ] **Step 3: Render the status consistently**

Add a `Casă` column to the reusable recent documents table and the filtered documents table. Show the badge for sales and `—` for other types. Place the edit control in sale row actions when `canModify`. Add `cashRegistered` to `DocumentDetailsValue` and render the badge/label only for sales.

The existing `salesByDay` archive must use the same row renderer or explicitly render the same badge; do not limit the feature to today's list.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm test src/app/operations/__tests__/cash-register-display.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Apply the additive database change**

Run: `pnpm db:push`

Expected: Prisma reports a successful schema synchronization; existing rows remain with `cashRegistered = null`.

- [ ] **Step 6: Commit display integration**

```bash
git add src/lib/operations/queries.ts src/lib/documents/queries.ts src/app/crm/page.tsx src/app/operations/document-details.tsx src/app/operations/__tests__/cash-register-display.test.ts
git commit -m "feat: show sale cash register status"
```

---

### Task 6: Full cash-status verification

**Files:**
- Modify only files needed to fix failures directly caused by Tasks 1–5.

**Interfaces:**
- Consumes: complete creation, approval, display, and update flow.
- Produces: evidence for every cash-register acceptance criterion.

- [ ] **Step 1: Run automated verification**

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Expected: every command exits 0 without new warnings.

- [ ] **Step 2: Verify privileged direct sale**

Create one `Da` and one `Nu` sale as `ADMIN` or `DIRECTOR`. Confirm both stock changes are unchanged from current behavior and their badges read `Bătut în casă` and `Nebătut în casă` in today's list and document list.

- [ ] **Step 3: Verify employee approval propagation**

Submit a sale as `ANGAJAT`, confirm the approval card shows the submitted status, approve it as `DIRECTOR`/`ADMIN`, and confirm the final sale keeps the same badge.

- [ ] **Step 4: Verify correction and authorization**

Change a sale through all three values and confirm the audit history records old/new status each time. Confirm stock quantities, line values, total, and date remain unchanged. Confirm an employee cannot access the correction control and direct action submission is rejected.

- [ ] **Step 5: Verify historical and non-sale behavior**

Confirm an existing sale with `null` displays `Nespecificat`. Attempt the server action against a receipt ID and confirm it returns the validation error without changing the document.

- [ ] **Step 6: Re-run the owning task after any verification fix**

If verification exposes a defect, return to the task that owns that behavior,
repeat its RED/GREEN checks, and include the exact corrected file in that
task's commit. When no defect is found, no additional commit is created.
