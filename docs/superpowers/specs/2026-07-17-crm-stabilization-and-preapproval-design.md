# CRM stabilization and stock pre-approval design

## Goal

Stabilize CRM navigation and feedback, then ensure that an employee cannot
change stock until a director or administrator approves the requested
operation.

## Scope

This first stage covers:

- CRM navigation, filtering, and pagination under `/crm`;
- stock-changing actions available to the `ANGAJAT` role;
- the approval inbox and its decision flow;
- transactional audit guarantees for stock operations;
- consistent action feedback;
- automated regression coverage for the affected behavior.

It does not redesign the public catalog or introduce unrelated CRM modules.

## Routing stabilization

All internal CRM URLs must use `/crm` as their base.

- Sidebar groups and section tabs use `/crm?section=...`.
- Product pagination retains filters under `/crm`.
- Document filtering and pagination submit to `/crm`.
- Audit-history filters retain `section`, `act`, and `doc` under `/crm`.
- A shared CRM URL helper replaces scattered root-relative URL construction.
- Regression tests cover section, pagination, document, and audit URLs.

## Approval domain model

Introduce a dedicated `PendingOperation` record instead of using `AuditLog` as
an executable queue.

Each request stores:

- a typed operation kind;
- the requesting user's identity and role;
- a validated JSON payload;
- a readable summary;
- `PENDING`, `APPROVED`, or `REJECTED` status;
- reviewer identity, decision timestamp, and optional note;
- the identifier of the applied document or account, when applicable;
- creation and update timestamps.

The first supported operation kinds are:

- employee-created direct sale;
- employee-requested payment-account fulfillment.

Operations that do not change stock remain immediate unless an existing role
rule already restricts them.

## Submission behavior

For `DIRECTOR` and `ADMIN`, stock-changing actions continue to execute
immediately.

For `ANGAJAT`:

1. Parse and validate the submitted form.
2. Verify that referenced products, warehouse, customer, and payment account
   exist and are eligible.
3. Store a `PendingOperation`.
4. Do not create a final stock document.
5. Do not decrement warehouse or aggregate stock.
6. Do not create restock tasks.
7. Return a clear message that the request awaits approval.

Submission-time validation improves feedback but does not reserve stock.

## Approval behavior

Approval is executed by `DIRECTOR` or `ADMIN` inside one database transaction.

1. Lock or conditionally claim the pending request so it can be applied once.
2. Re-read all referenced records.
3. Revalidate current stock and current operation/account state.
4. Execute the same domain service used by an immediate privileged action.
5. Create the final stock document and related restock tasks.
6. Update warehouse and aggregate stock.
7. Write the audit entry.
8. Mark the request `APPROVED` and store the resulting entity identifier.

If validation fails, the transaction rolls back and the request remains
`PENDING` with a visible approval error. Concurrent approvals and repeated
submissions cannot apply the operation twice.

## Rejection behavior

`Semnalează` becomes `Respinge`.

- Rejection requires a short reason.
- The request becomes `REJECTED`.
- No stock, document, or payment-account fulfillment state is changed.
- Rejected requests remain visible in recent decisions.
- A rejected request cannot later be approved; a new corrected request must be
  submitted.

## Shared execution services

Extract stock-changing business logic from server actions into focused domain
services:

- sale execution;
- payment-account fulfillment;
- stock-row creation and stock synchronization;
- audit writing inside the transaction.

Server actions decide whether to execute immediately or enqueue a request.
Approval actions call the same execution services, avoiding duplicated stock
logic.

## Audit guarantees

`AuditLog` remains an immutable history, not the approval queue.

- A successful stock transaction must contain its audit write.
- Audit failures inside stock transactions must propagate and roll back the
  operation.
- Non-critical audit calls outside transactions may remain best-effort only
  when explicitly requested by the caller.
- Approval and rejection decisions receive their own audit entries.

## CRM feedback and approval UI

- Replace scattered `window.alert()` success/error feedback with a shared
  inline notification or toast component.
- Keep destructive confirmations explicit.
- Show pending requests as structured sale/account summaries instead of raw
  JSON.
- Display requester, warehouse, customer, products, quantities, values, and
  request time.
- Approval and rejection buttons expose pending states and prevent repeated
  clicks.
- Show the applied document link after approval.
- Preserve the pending-count badge in the CRM navigation.

## Code boundaries

The 3,000-line CRM page is split only where the current work benefits:

- routing helpers;
- approval workspace;
- pending-operation domain code;
- shared action feedback.

Unrelated CRM sections remain in place for this stage to keep the change
reviewable.

## Testing

Automated coverage must prove:

- every internal CRM link and form retains the `/crm` base;
- employee sale submission leaves stock and documents unchanged;
- employee fulfillment submission leaves stock and account state unchanged;
- privileged operations still apply immediately;
- approval applies an operation exactly once;
- two concurrent approvals cannot double-decrement stock;
- insufficient stock at approval causes a full rollback;
- rejection causes no stock mutation;
- only `DIRECTOR` and `ADMIN` can approve or reject;
- transactional audit failure rolls back the stock change;
- the workspace section test includes approvals;
- the standard test command loads the required test environment safely.

Verification includes unit tests, lint, production build, and authenticated
Chrome checks on desktop and mobile-sized layouts when browser control is
available.
