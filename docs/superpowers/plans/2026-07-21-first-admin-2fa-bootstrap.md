# First Administrator 2FA Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let exactly the deterministic first active administrator initialize the application's first TOTP credential without an activation code, permanently close that bootstrap path after first activation, and replace dispatcher white screens with a safe recovery page.

**Architecture:** Add one global Prisma security-state row that permanently records completed bootstrap, then isolate bootstrap policy and transactional enrollment in a focused `bootstrap.ts` service. Extend the existing setup state with `BOOTSTRAP_AVAILABLE`, expose a dedicated server action and form, and atomically close bootstrap during TOTP activation. Keep `/auth/2fa/continue` as a redirect handler but catch failures and route them to a server-rendered recovery page.

**Tech Stack:** Next.js 16 App Router, React 19 server actions, TypeScript, Prisma 7 with Neon Postgres, Node test runner through `tsx`, TOTP through `otpauth`.

## Global Constraints

- Bootstrap is available only to the earliest-created active `ADMIN`, ordered by `createdAt` then `id`.
- Bootstrap requires a username, zero `ACTIVE` TOTP credentials, and an unset global completion marker.
- GET rendering must not create or rotate credentials; enrollment starts only through a server action.
- Pending setup remains encrypted, valid for 15 minutes, and bound to the exact Neon Auth session.
- `TWO_FACTOR_BOOTSTRAP_STARTED` audit is required and contains no secrets, hashes, cookies, or session identifiers.
- First successful TOTP activation sets the global completion marker atomically; reset and deletion never clear it.
- Dispatcher errors expose no exception details and always offer retry and fresh sign-in paths.
- Do not weaken existing activation-code, self-reset, rate-limit, trusted-device, or break-glass behavior.

---

### Task 1: Persistent bootstrap completion state and idempotent production backfill

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `scripts/backfill-2fa-bootstrap-state.ts`
- Modify: `package.json`
- Create: `src/lib/auth/two-factor/__tests__/bootstrap-backfill.test.ts`
- Regenerate: `src/generated/prisma/**`

**Interfaces:**
- Produces Prisma delegate `applicationSecurityState` for model `ApplicationSecurityState`.
- Produces command `pnpm 2fa:backfill-bootstrap`.
- The fixed global row ID is exported by the backfill script as `SECURITY_STATE_ID = "global"` only if the script is refactored into an import-safe helper; otherwise repeat the literal in `bootstrap.ts` and test both source files for equality.

- [ ] **Step 1: Write the failing schema/backfill contract test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("schema persists an immutable global 2FA bootstrap completion marker", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /model ApplicationSecurityState/);
  assert.match(schema, /twoFactorBootstrapCompletedAt\s+DateTime\?/);
});

test("backfill marks bootstrap completed only when an active credential exists", () => {
  const source = readFileSync("scripts/backfill-2fa-bootstrap-state.ts", "utf8");
  assert.match(source, /status:\s*["']ACTIVE["']/);
  assert.match(source, /applicationSecurityState\.upsert/);
  assert.match(source, /id:\s*["']global["']/);
  assert.doesNotMatch(source, /delete|deleteMany/);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `pnpm test src/lib/auth/two-factor/__tests__/bootstrap-backfill.test.ts`

Expected: FAIL because `ApplicationSecurityState` and the backfill script do not exist.

- [ ] **Step 3: Add the Prisma model and package command**

Add to `prisma/schema.prisma`:

```prisma
model ApplicationSecurityState {
  id                            String    @id
  twoFactorBootstrapCompletedAt DateTime?
  createdAt                     DateTime  @default(now())
  updatedAt                     DateTime  @updatedAt
}
```

Add to `package.json` scripts:

```json
"2fa:backfill-bootstrap": "tsx --env-file=.env scripts/backfill-2fa-bootstrap-state.ts"
```

- [ ] **Step 4: Implement the idempotent backfill script**

Create `scripts/backfill-2fa-bootstrap-state.ts` with the same Prisma adapter initialization pattern as `scripts/bootstrap-staff-accounts.ts`. Its `main()` must execute:

```ts
const activeCredentials = await prisma.twoFactorCredential.count({
  where: { status: "ACTIVE" },
});

if (activeCredentials === 0) {
  console.log("Bootstrap 2FA rămâne disponibil: nu există credențiale active.");
  return;
}

const now = new Date();
await prisma.applicationSecurityState.upsert({
  where: { id: "global" },
  create: { id: "global", twoFactorBootstrapCompletedAt: now },
  update: {
    twoFactorBootstrapCompletedAt: {
      set: now,
    },
  },
});
console.log("Bootstrap 2FA marcat ca finalizat pentru instalarea existentă.");
```

Before the upsert, read the row and return without updating when its timestamp is already set, so repeated runs preserve the original completion time.

- [ ] **Step 5: Regenerate Prisma and validate the schema**

Run: `pnpm exec prisma generate && pnpm exec prisma validate`

Expected: generated client includes `ApplicationSecurityState`; schema validation succeeds.

- [ ] **Step 6: Run the contract test and verify GREEN**

Run: `pnpm test src/lib/auth/two-factor/__tests__/bootstrap-backfill.test.ts`

Expected: 2 tests pass.

- [ ] **Step 7: Commit the state model and backfill**

```bash
git add prisma/schema.prisma package.json scripts/backfill-2fa-bootstrap-state.ts src/generated/prisma src/lib/auth/two-factor/__tests__/bootstrap-backfill.test.ts
git commit -m "feat: persist 2fa bootstrap completion"
```

---

### Task 2: Pure bootstrap eligibility policy and read-only setup state

**Files:**
- Create: `src/lib/auth/two-factor/bootstrap.ts`
- Modify: `src/lib/auth/two-factor/enrollment.ts`
- Create: `src/lib/auth/two-factor/__tests__/bootstrap.test.ts`
- Modify: `src/lib/auth/two-factor/__tests__/enrollment.test.ts`

**Interfaces:**
- Produces `isInitialTwoFactorBootstrapEligible(input: BootstrapEligibilityInput): boolean`.
- Produces `getInitialTwoFactorBootstrapEligibility(primary: PrimaryAuthContext): Promise<boolean>`.
- Extends `EnrollmentSetupState` with `{ kind: "BOOTSTRAP_AVAILABLE" }`.
- `getEnrollmentSetupState()` remains read-only.

- [ ] **Step 1: Write failing policy tests**

Create table-driven tests that call the wished-for pure function:

```ts
const eligible = {
  currentUser: { id: "admin-1", role: "ADMIN", active: true, username: "admin" },
  firstActiveAdminId: "admin-1",
  activeCredentialCount: 0,
  bootstrapCompletedAt: null,
};

test("allows only the deterministic first active administrator before initialization", () => {
  assert.equal(isInitialTwoFactorBootstrapEligible(eligible), true);
});

for (const [name, change] of [
  ["employee", { currentUser: { ...eligible.currentUser, role: "ANGAJAT" } }],
  ["director", { currentUser: { ...eligible.currentUser, role: "DIRECTOR" } }],
  ["later administrator", { firstActiveAdminId: "admin-0" }],
  ["inactive administrator", { currentUser: { ...eligible.currentUser, active: false } }],
  ["administrator without username", { currentUser: { ...eligible.currentUser, username: null } }],
  ["existing active credential", { activeCredentialCount: 1 }],
  ["completed bootstrap", { bootstrapCompletedAt: new Date("2026-07-21T12:00:00Z") }],
] as const) {
  test(`rejects ${name}`, () => {
    assert.equal(isInitialTwoFactorBootstrapEligible({ ...eligible, ...change }), false);
  });
}
```

Update the enrollment test so a missing credential can resolve to either activation or bootstrap based on an explicit eligibility boolean:

```ts
assert.equal(
  resolveEnrollmentSetupKind(null, "session_hash", now, false),
  "ACTIVATION_REQUIRED",
);
assert.equal(
  resolveEnrollmentSetupKind(null, "session_hash", now, true),
  "BOOTSTRAP_AVAILABLE",
);
```

- [ ] **Step 2: Run policy tests and verify RED**

Run: `pnpm test src/lib/auth/two-factor/__tests__/bootstrap.test.ts src/lib/auth/two-factor/__tests__/enrollment.test.ts`

Expected: FAIL because the policy module and fourth resolver argument do not exist.

- [ ] **Step 3: Implement the pure policy and database reader**

In `bootstrap.ts`, define:

```ts
export const APPLICATION_SECURITY_STATE_ID = "global";

export type BootstrapEligibilityInput = {
  currentUser: {
    id: string;
    role: "ADMIN" | "DIRECTOR" | "ANGAJAT";
    active: boolean;
    username: string | null;
  } | null;
  firstActiveAdminId: string | null;
  activeCredentialCount: number;
  bootstrapCompletedAt: Date | null;
};

export function isInitialTwoFactorBootstrapEligible(input: BootstrapEligibilityInput) {
  return Boolean(
    input.currentUser?.active
      && input.currentUser.role === "ADMIN"
      && input.currentUser.username
      && input.currentUser.id === input.firstActiveAdminId
      && input.activeCredentialCount === 0
      && !input.bootstrapCompletedAt,
  );
}
```

`getInitialTwoFactorBootstrapEligibility()` must load the current user, the first matching admin with `orderBy: [{ createdAt: "asc" }, { id: "asc" }]`, active credential count, and fixed global state row, then call the pure policy. Use `Promise.all` because these reads are independent.

- [ ] **Step 4: Extend enrollment setup resolution without GET mutations**

Change the resolver signature to:

```ts
export function resolveEnrollmentSetupKind(
  credential: PendingCredential | null,
  authSessionHash: string,
  now: Date,
  bootstrapEligible = false,
)
```

Return `BOOTSTRAP_AVAILABLE` only when `credential` is absent or unusable and `bootstrapEligible` is true. Preserve `READY` and `REJECT_ACTIVE` precedence. In `getEnrollmentSetupState()`, call the database eligibility reader only after the existing credential cannot produce `READY` or `REJECT_ACTIVE`, then return `{ kind: "BOOTSTRAP_AVAILABLE" }` or `{ kind: "ACTIVATION_REQUIRED" }`. Do not create, update, or delete records in this function.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm test src/lib/auth/two-factor/__tests__/bootstrap.test.ts src/lib/auth/two-factor/__tests__/enrollment.test.ts`

Expected: all bootstrap policy and enrollment state tests pass.

- [ ] **Step 6: Commit the policy and setup state**

```bash
git add src/lib/auth/two-factor/bootstrap.ts src/lib/auth/two-factor/enrollment.ts src/lib/auth/two-factor/__tests__/bootstrap.test.ts src/lib/auth/two-factor/__tests__/enrollment.test.ts
git commit -m "feat: detect initial 2fa bootstrap eligibility"
```

---

### Task 3: Transactional bootstrap enrollment service

**Files:**
- Modify: `src/lib/auth/two-factor/bootstrap.ts`
- Modify: `src/lib/auth/two-factor/__tests__/bootstrap.test.ts`

**Interfaces:**
- Produces `startInitialTwoFactorBootstrap(input: { primary: PrimaryAuthContext; now?: Date }): Promise<TotpEnrollmentView>`.
- Consumes `createTotpEnrollment`, `encryptTotpSecret`, `hashNeonSessionId`, `readTwoFactorConfig`, `logAuditRequired`, and the policy from Task 2.

- [ ] **Step 1: Add failing transaction contract tests**

Because the service is coupled to Prisma, add source-contract assertions alongside pure policy tests to lock the security boundaries:

```ts
test("bootstrap enrollment revalidates and creates the pending credential serializably", () => {
  const source = readFileSync("src/lib/auth/two-factor/bootstrap.ts", "utf8");
  assert.match(source, /isolationLevel:\s*["']Serializable["']/);
  assert.match(source, /orderBy:\s*\[\{\s*createdAt:\s*["']asc["']\s*\},\s*\{\s*id:\s*["']asc["']/s);
  assert.match(source, /status:\s*["']ACTIVE["']/);
  assert.match(source, /twoFactorCredential\.deleteMany/);
  assert.match(source, /twoFactorCredential\.create/);
  assert.match(source, /enrollmentAuthSessionHash:\s*hashNeonSessionId/);
  assert.match(source, /TWO_FACTOR_BOOTSTRAP_STARTED/);
  assert.match(source, /logAuditRequired/);
  assert.doesNotMatch(source, /consumeEnrollmentGrant/);
});
```

Also test an exported pure `bootstrapSetupExpiry(now)` returns exactly 15 minutes later.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test src/lib/auth/two-factor/__tests__/bootstrap.test.ts`

Expected: FAIL because the transactional service, audit event, and expiry helper are missing.

- [ ] **Step 3: Implement serializable retry and transactional enrollment**

Inside `bootstrap.ts`, add a private four-attempt retry for Prisma `P2034`, matching `rate-limit.ts`. `startInitialTwoFactorBootstrap()` must run a `Serializable` interactive transaction that:

1. reloads the current user with `id`, `active`, `username`, `role`, `name`, `email`, and `twoFactorResetAt`;
2. rejects a stale reset session using the same comparison as activation-code enrollment;
3. reloads first active admin, active credential count, and global marker inside the transaction;
4. calls `isInitialTwoFactorBootstrapEligible()` and throws `InitialTwoFactorBootstrapUnavailableError` when false;
5. generates TOTP, deletes only the current user's `PENDING` credential, and creates one encrypted `PENDING` credential with `bootstrapSetupExpiry(now)` and the current session hash;
6. writes required audit entity `TwoFactorCredential`, summary `Bootstrap 2FA inițiat pentru ${username}`, details `{ event: "TWO_FACTOR_BOOTSTRAP_STARTED" }`;
7. returns credential ID, plaintext secret, URI, and expiry only after transaction success.

Define `InitialTwoFactorBootstrapUnavailableError` with the safe Romanian message `Inițializarea 2FA nu mai este disponibilă. Cere unui administrator un cod de activare.`

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm test src/lib/auth/two-factor/__tests__/bootstrap.test.ts`

Expected: all policy, expiry, and transaction contract tests pass.

- [ ] **Step 5: Commit the transactional service**

```bash
git add src/lib/auth/two-factor/bootstrap.ts src/lib/auth/two-factor/__tests__/bootstrap.test.ts
git commit -m "feat: start first admin 2fa bootstrap"
```

---

### Task 4: Bootstrap server action and setup UI

**Files:**
- Create: `src/app/auth/2fa/setup/bootstrap-form.tsx`
- Modify: `src/app/auth/2fa/actions.ts`
- Modify: `src/app/auth/2fa/setup/page.tsx`
- Create: `src/app/auth/__tests__/two-factor-bootstrap-ui.test.ts`

**Interfaces:**
- Produces server action `startInitialTwoFactorBootstrapAction(): Promise<void>`.
- Produces client component `BootstrapForm`.
- Consumes `startInitialTwoFactorBootstrap()` and setup state `BOOTSTRAP_AVAILABLE`.

- [ ] **Step 1: Write the failing UI/action contract test**

```ts
test("eligible first admin gets an explicit bootstrap action instead of an activation code", () => {
  const page = readFileSync("src/app/auth/2fa/setup/page.tsx", "utf8");
  const actions = readFileSync("src/app/auth/2fa/actions.ts", "utf8");
  const form = readFileSync("src/app/auth/2fa/setup/bootstrap-form.tsx", "utf8");

  assert.match(page, /BOOTSTRAP_AVAILABLE/);
  assert.match(page, /<BootstrapForm\s*\/>/);
  assert.match(actions, /startInitialTwoFactorBootstrapAction/);
  assert.match(actions, /startInitialTwoFactorBootstrap\(\{\s*primary/s);
  assert.match(actions, /redirect\(["']\/auth\/2fa\/setup["']\)/);
  assert.match(form, /Inițializează 2FA/);
  assert.doesNotMatch(form, /activationCode/);
});
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `pnpm test src/app/auth/__tests__/two-factor-bootstrap-ui.test.ts`

Expected: FAIL because `bootstrap-form.tsx` and the server action do not exist.

- [ ] **Step 3: Implement the server action**

Add an action that loads `getPrimaryAuthContext()`, redirects unauthenticated users to sign-in, calls `startInitialTwoFactorBootstrap({ primary })`, converts `InitialTwoFactorBootstrapUnavailableError` through `safeTwoFactorError`, and redirects success to `/auth/2fa/setup`. Extend `safeTwoFactorError()` to whitelist only the new safe error class; unexpected errors remain logged server-side with the existing generic response.

- [ ] **Step 4: Implement the dedicated bootstrap form**

Create a server-action form with explanatory Romanian copy:

```tsx
export function BootstrapForm() {
  return (
    <form action={startInitialTwoFactorBootstrapAction} className="grid gap-4">
      <div className="rounded-xl border border-[#b2ddff] bg-[#eff8ff] px-4 py-3 text-sm leading-6 text-[#175cd3]">
        Acesta este primul cont de administrator. Poți configura primul Authenticator fără un cod emis de alt administrator.
      </div>
      <button type="submit" className="h-11 rounded-md bg-[#1b1a17] text-sm font-semibold text-white hover:bg-[#33312c]">
        Inițializează 2FA
      </button>
    </form>
  );
}
```

The setup page renders this form only for `BOOTSTRAP_AVAILABLE`; it retains the current activation and QR branches unchanged.

- [ ] **Step 5: Run UI and enrollment tests and verify GREEN**

Run: `pnpm test src/app/auth/__tests__/two-factor-bootstrap-ui.test.ts src/lib/auth/two-factor/__tests__/bootstrap.test.ts src/lib/auth/two-factor/__tests__/enrollment.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit the action and UI**

```bash
git add src/app/auth/2fa/setup/bootstrap-form.tsx src/app/auth/2fa/actions.ts src/app/auth/2fa/setup/page.tsx src/app/auth/__tests__/two-factor-bootstrap-ui.test.ts
git commit -m "feat: show first admin 2fa bootstrap"
```

---

### Task 5: Permanently close bootstrap during first successful activation

**Files:**
- Modify: `src/lib/auth/two-factor/enrollment.ts`
- Modify: `src/lib/auth/two-factor/__tests__/enrollment.test.ts`

**Interfaces:**
- Consumes `APPLICATION_SECURITY_STATE_ID` from `bootstrap.ts`.
- Successful `confirmPendingEnrollment()` upserts the global completion marker inside its existing credential-activation transaction.

- [ ] **Step 1: Write the failing activation-marker contract test**

```ts
test("successful TOTP activation permanently closes initial bootstrap atomically", () => {
  const source = readFileSync("src/lib/auth/two-factor/enrollment.ts", "utf8");
  const transaction = source.indexOf("prisma.$transaction", source.indexOf("confirmPendingEnrollment"));
  const activation = source.indexOf("twoFactorCredential.updateMany", transaction);
  const marker = source.indexOf("applicationSecurityState.upsert", activation);
  const audit = source.indexOf("logAuditRequired", marker);

  assert.ok(transaction >= 0 && activation > transaction);
  assert.ok(marker > activation && audit > marker);
  assert.match(source.slice(marker, audit), /twoFactorBootstrapCompletedAt:\s*now/);
  assert.doesNotMatch(source, /twoFactorBootstrapCompletedAt:\s*null/);
});
```

- [ ] **Step 2: Run the enrollment test and verify RED**

Run: `pnpm test src/lib/auth/two-factor/__tests__/enrollment.test.ts`

Expected: FAIL because activation does not write `ApplicationSecurityState`.

- [ ] **Step 3: Upsert the marker inside activation transaction**

Immediately after successful `twoFactorCredential.updateMany()` and before the activation audit, execute:

```ts
await tx.applicationSecurityState.upsert({
  where: { id: APPLICATION_SECURITY_STATE_ID },
  create: {
    id: APPLICATION_SECURITY_STATE_ID,
    twoFactorBootstrapCompletedAt: now,
  },
  update: {},
});
await tx.applicationSecurityState.updateMany({
  where: {
    id: APPLICATION_SECURITY_STATE_ID,
    twoFactorBootstrapCompletedAt: null,
  },
  data: { twoFactorBootstrapCompletedAt: now },
});
```

This preserves an existing completion timestamp and fills a pre-created row whose timestamp is null. Do not add marker deletion to reset, staff deletion, deactivation, or break-glass flows.

- [ ] **Step 4: Run lifecycle and enrollment tests and verify GREEN**

Run: `pnpm test src/lib/auth/two-factor/__tests__/enrollment.test.ts src/app/auth/__tests__/two-factor-lifecycle.test.ts src/lib/staff/__tests__/two-factor-reset.test.ts src/lib/staff/__tests__/break-glass.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit permanent bootstrap closure**

```bash
git add src/lib/auth/two-factor/enrollment.ts src/lib/auth/two-factor/__tests__/enrollment.test.ts
git commit -m "feat: close 2fa bootstrap after activation"
```

---

### Task 6: Dispatcher error recovery page instead of white screen

**Files:**
- Modify: `src/app/auth/2fa/continue/route.ts`
- Create: `src/app/auth/2fa/error/page.tsx`
- Modify: `src/app/auth/__tests__/two-factor-routing.test.ts`

**Interfaces:**
- Normal dispatcher redirects remain unchanged.
- Any unexpected dispatcher exception redirects to `/auth/2fa/error`.
- Recovery page provides exact links `/auth/2fa/continue` and `/auth/sign-in`.

- [ ] **Step 1: Write the failing error-recovery route test**

Extend the routing test:

```ts
test("dispatcher failures render a safe recovery page instead of an empty response", () => {
  const route = readFileSync("src/app/auth/2fa/continue/route.ts", "utf8");
  const page = readFileSync("src/app/auth/2fa/error/page.tsx", "utf8");

  assert.match(route, /try\s*\{/);
  assert.match(route, /catch\s*\(/);
  assert.match(route, /\[2fa\] continuation failed/);
  assert.match(route, /\/auth\/2fa\/error/);
  assert.match(page, /\/auth\/2fa\/continue/);
  assert.match(page, /\/auth\/sign-in/);
  assert.match(page, /Autentificarea nu a putut fi finalizată/);
});
```

- [ ] **Step 2: Run the routing test and verify RED**

Run: `pnpm test src/app/auth/__tests__/two-factor-routing.test.ts`

Expected: FAIL because the route lacks the catch and the error page is absent.

- [ ] **Step 3: Refactor the dispatcher into a caught handler**

Move the current switch unchanged into `continueAfterPrimaryAuth(request)`. `GET` wraps it:

```ts
export async function GET(request: NextRequest) {
  try {
    return await continueAfterPrimaryAuth(request);
  } catch (error) {
    console.error("[2fa] continuation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.redirect(new URL("/auth/2fa/error", request.url));
  }
}
```

Do not log `error.message`, request cookies, URLs with query strings, sessions, or database values.

- [ ] **Step 4: Create the server-rendered recovery page**

Use `TwoFactorShell` with title `Autentificarea nu a putut fi finalizată`, a generic retry explanation, a primary `Link` to `/auth/2fa/continue`, and a secondary `Link` to `/auth/sign-in`. The page contains no client hooks and no query-parameter echoing.

- [ ] **Step 5: Run routing tests and verify GREEN**

Run: `pnpm test src/app/auth/__tests__/two-factor-routing.test.ts src/app/auth/__tests__/two-factor-login-routing.test.ts`

Expected: both dispatcher suites pass.

- [ ] **Step 6: Commit error recovery**

```bash
git add src/app/auth/2fa/continue/route.ts src/app/auth/2fa/error/page.tsx src/app/auth/__tests__/two-factor-routing.test.ts
git commit -m "fix: recover from 2fa dispatcher failures"
```

---

### Task 7: Full verification and rollout documentation

**Files:**
- Modify: `docs/runbooks/two-factor-authentication.md`
- Modify only if required by verification: files already touched in Tasks 1-6

**Interfaces:**
- Documents schema application, `pnpm 2fa:backfill-bootstrap`, first-admin phone flow, and rollback behavior.

- [ ] **Step 1: Update the runbook**

Add a `Primul administrator` section that states:

```md
După aplicarea schemei, rulează o singură dată comanda idempotentă:

pnpm 2fa:backfill-bootstrap

Dacă nu există nicio credențială 2FA activă, primul administrator activ vede
butonul „Inițializează 2FA” după autentificarea principală. După confirmarea
primului TOTP, bootstrap-ul din browser se închide permanent. Resetările
ulterioare folosesc emiterea normală de cod sau comanda break-glass.
```

Document that existing installations with active credentials must run the backfill after schema deployment and before application code deployment.

- [ ] **Step 2: Run complete automated verification**

Run in this order:

```bash
pnpm exec prisma validate
pnpm test
pnpm lint
pnpm build
```

Expected: schema valid, all tests pass, lint has no errors, production build succeeds.

- [ ] **Step 3: Inspect the final diff for security regressions**

Run:

```bash
git diff --check
git status --short
git diff HEAD~6 -- prisma/schema.prisma package.json scripts/backfill-2fa-bootstrap-state.ts src/lib/auth/two-factor src/app/auth/2fa docs/runbooks/two-factor-authentication.md
```

Confirm there is no secret logging, no bootstrap marker deletion, no GET mutation, no activation-code bypass for non-eligible users, and no unrelated change.

- [ ] **Step 4: Commit rollout documentation**

```bash
git add docs/runbooks/two-factor-authentication.md
git commit -m "docs: document first admin 2fa bootstrap"
```

- [ ] **Step 5: Perform manual production-like verification before deployment**

Apply the schema and backfill to a Neon branch or verified local database, then verify:

1. Google login at a phone-sized viewport reaches `/auth/2fa/setup`.
2. The deterministic first admin sees `Inițializează 2FA` and no activation-code input.
3. Clicking creates the QR; confirming a current code reaches `/crm`.
4. A fresh login requires the TOTP code.
5. Another user without 2FA still sees the administrator activation-code form.
6. Reloading `/auth/2fa/continue` during a simulated backend error reaches the recovery page, not a blank body.

Do not deploy to production or mutate the production database without explicit deployment authorization.
