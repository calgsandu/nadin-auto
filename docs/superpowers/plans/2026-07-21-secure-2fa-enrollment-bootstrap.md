# Secure 2FA Enrollment Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a short-lived, single-use administrator activation code before any TOTP QR or manual secret can be created or shown, including after reset and during break-glass recovery.

**Architecture:** Store one hashed activation grant per user and bind every pending TOTP credential to the exact Neon session that consumed it. Keep the existing four-state authentication dispatcher; the setup route renders either the activation gate or the already-authorized QR state. Normal issuance, reset, grant consumption, activation, and break-glass all use required audit writes inside their local database transactions.

**Tech Stack:** Next.js 16 App Router and Server Actions, React 19, TypeScript 5, Prisma 7 with Neon PostgreSQL, Node `crypto`, Node test runner through `tsx`, ESLint.

## Global Constraints

- Activation codes use 16 Crockford Base32 characters, 80 random bits, display format `XXXX-XXXX-XXXX-XXXX`, and expire after exactly 15 minutes.
- Persist only `SHA-256("nadin-auto:2fa-enrollment-grant:" || normalizedCode)`; never persist or log plaintext codes.
- Do not create, decrypt, or render a TOTP secret until a valid grant is consumed.
- A pending credential is usable only by the exact Neon session whose domain-separated hash is stored on it.
- Normal administrator actions cannot target the current administrator; sole-admin recovery remains interactive CLI only.
- Issuance, consumption, reset, and activation audit writes are mandatory and transactional.
- Existing active credentials remain valid; legacy unbound pending credentials are unusable.
- Work directly on `main`, preserve unrelated changes, use `apply_patch`, and commit each completed task.
- Do not push Git or use `--accept-data-loss`.

---

### Task 1: Activation code primitives and additive schema

**Files:**
- Create: `src/lib/auth/two-factor/activation-code.ts`
- Create: `src/lib/auth/two-factor/__tests__/activation-code.test.ts`
- Modify: `src/lib/auth/two-factor/crypto.ts`
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/auth/two-factor/__tests__/crypto.test.ts`

**Interfaces:**
- Produces: `generateEnrollmentActivationCode(bytes?: Buffer): string`
- Produces: `normalizeEnrollmentActivationCode(value: string): string`
- Produces: `hashEnrollmentActivationCode(normalizedCode: string): string`
- Produces: `enrollmentActivationExpiry(now: Date): Date`
- Produces: Prisma `TwoFactorEnrollmentGrant` and `TwoFactorCredential.enrollmentAuthSessionHash`

- [ ] **Step 1: Write failing primitive and schema tests**

Create deterministic tests with `Buffer.from("00010203040506070809", "hex")`. Assert that generation returns four groups of four allowed Crockford characters, normalization accepts lowercase/spaces/hyphens but rejects wrong length and ambiguous characters, hashes are stable and domain-separated from `hashToken`, and expiry is exactly 900,000 milliseconds. Add source assertions for the new Prisma model, unique user/hash fields, expiry index, cascade relation, and nullable session binding.

```ts
assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
assert.equal(normalizeEnrollmentActivationCode(code.toLowerCase()), code.replaceAll("-", ""));
assert.equal(enrollmentActivationExpiry(now).getTime() - now.getTime(), 15 * 60_000);
assert.notEqual(hashEnrollmentActivationCode(normalized), hashToken(normalized));
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/activation-code.test.ts src/lib/auth/two-factor/__tests__/crypto.test.ts
```

Expected: FAIL because the activation-code module, hash helper, and schema fields do not exist.

- [ ] **Step 3: Implement the primitives and schema**

Use the exact alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`. Encode ten bytes as a fixed 16-character Base32 value without modulo bias, group it for display, and normalize only spaces/hyphens/case. Add a domain-separated SHA-256 helper to `crypto.ts`.

Add:

```prisma
model TwoFactorEnrollmentGrant {
  id        String   @id @default(cuid())
  appUserId String   @unique
  tokenHash String   @unique
  expiresAt DateTime
  appUser   AppUser  @relation(fields: [appUserId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([expiresAt])
}
```

Add `twoFactorEnrollmentGrant TwoFactorEnrollmentGrant?` to `AppUser` and `enrollmentAuthSessionHash String?` to `TwoFactorCredential`.

- [ ] **Step 4: Generate Prisma and verify the additive database diff**

Run:

```bash
pnpm prisma:generate
pnpm exec prisma validate
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
```

Expected: only one table, one nullable column, indexes, and foreign keys are added; no deletion or data conversion appears.

- [ ] **Step 5: Apply the safe schema and verify GREEN**

Run:

```bash
pnpm db:push
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/activation-code.test.ts src/lib/auth/two-factor/__tests__/crypto.test.ts
pnpm exec eslint src/lib/auth/two-factor/activation-code.ts src/lib/auth/two-factor/crypto.ts src/lib/auth/two-factor/__tests__/activation-code.test.ts
```

Expected: the second diff says `No difference detected`; tests and lint pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/generated/prisma src/lib/auth/two-factor/activation-code.ts src/lib/auth/two-factor/crypto.ts src/lib/auth/two-factor/__tests__/activation-code.test.ts src/lib/auth/two-factor/__tests__/crypto.test.ts
git diff --cached --check
git commit -m "feat: add secure 2FA activation grant primitives"
```

---

### Task 2: Grant issuance, replacement, consumption, and invalidation services

**Files:**
- Create: `src/lib/auth/two-factor/enrollment-grant.ts`
- Create: `src/lib/auth/two-factor/__tests__/enrollment-grant.test.ts`
- Modify: `src/lib/auth/two-factor/reset.ts`
- Modify: `src/lib/auth/two-factor/__tests__/reset.test.ts`

**Interfaces:**
- Consumes: activation code primitives from Task 1
- Produces: `replaceEnrollmentGrant(tx, appUserId, now, rawCode?): Promise<{ code: string; expiresAt: Date }>`
- Produces: `consumeEnrollmentGrant(tx, { appUserId, tokenHash, now }): Promise<boolean>`
- Produces: `clearEnrollmentGrant(tx, appUserId): Promise<void>`
- Updates: `resetTwoFactorCredential()` clears any outstanding grant

- [ ] **Step 1: Write failing lifecycle tests**

Use an in-memory fake client that records calls. Assert exact replacement order:

```ts
[
  "grant.deleteMany:user_1",
  "credential.deletePending:user_1",
  "grant.create:user_1",
]
```

Assert the created data contains only `tokenHash` and `expiresAt`, never the plaintext code. Assert consumption deletes exactly the matching `{ appUserId, tokenHash, expiresAt: { gt: now } }` row and returns true only when `count === 1`. Extend the reset test to require grant deletion before credential deletion and reset timestamp update.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/enrollment-grant.test.ts src/lib/auth/two-factor/__tests__/reset.test.ts
```

Expected: FAIL because the lifecycle module and reset cleanup do not exist.

- [ ] **Step 3: Implement the minimal lifecycle service**

Define a narrow structural client type instead of depending on the full Prisma client. `replaceEnrollmentGrant()` generates or accepts a test code, hashes its normalized representation, deletes the old grant and only `PENDING` credentials, creates the new grant, and returns the display code and expiry. `consumeEnrollmentGrant()` uses one atomic `deleteMany` condition. `clearEnrollmentGrant()` is idempotent.

Update `TwoFactorResetClient` and `resetTwoFactorCredential()` so every reset clears grants before proofs, trusted devices, and credentials.

- [ ] **Step 4: Run and verify GREEN**

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/enrollment-grant.test.ts src/lib/auth/two-factor/__tests__/reset.test.ts
pnpm exec eslint src/lib/auth/two-factor/enrollment-grant.ts src/lib/auth/two-factor/reset.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/two-factor/enrollment-grant.ts src/lib/auth/two-factor/reset.ts src/lib/auth/two-factor/__tests__/enrollment-grant.test.ts src/lib/auth/two-factor/__tests__/reset.test.ts
git diff --cached --check
git commit -m "feat: manage single-use 2FA enrollment grants"
```

---

### Task 3: Gate TOTP secret creation behind activation-code consumption

**Files:**
- Modify: `src/lib/auth/two-factor/enrollment.ts`
- Modify: `src/lib/auth/two-factor/__tests__/enrollment.test.ts`
- Modify: `src/app/auth/2fa/actions.ts`
- Modify: `src/app/auth/2fa/form-state.ts`
- Modify: `src/app/auth/2fa/setup/page.tsx`
- Create: `src/app/auth/2fa/setup/activation-form.tsx`
- Modify: `src/app/auth/2fa/setup/setup-form.tsx`
- Modify: `src/app/auth/__tests__/two-factor-setup.test.ts`
- Modify: `src/app/auth/__tests__/two-factor-lifecycle.test.ts`

**Interfaces:**
- Produces: `getEnrollmentSetupState(primary, now?): Promise<{ kind: "ACTIVATION_REQUIRED" } | { kind: "READY"; enrollment: TotpEnrollmentView }>`
- Produces: `startPendingEnrollmentWithActivationCode(input): Promise<void>`
- Produces: `activateTwoFactorEnrollmentAction(previous, formData): Promise<TwoFactorFormState>`
- Changes: pending credentials are created only by successful grant consumption and always include `enrollmentAuthSessionHash`

- [ ] **Step 1: Write failing setup-state and source-invariant tests**

Extend the pure enrollment decision with session binding:

```ts
assert.equal(resolveEnrollmentSetupKind(null, sessionHash, now), "ACTIVATION_REQUIRED");
assert.equal(resolveEnrollmentSetupKind(unboundPending, sessionHash, now), "ACTIVATION_REQUIRED");
assert.equal(resolveEnrollmentSetupKind(boundPending, sessionHash, now), "READY");
assert.equal(resolveEnrollmentSetupKind(boundPending, "other", now), "ACTIVATION_REQUIRED");
assert.equal(resolveEnrollmentSetupKind(expiredPending, sessionHash, now), "ACTIVATION_REQUIRED");
```

Update source tests to assert that `setup/page.tsx` renders `ActivationForm` before QR, the activation form contains only `activationCode`, no QR/manual secret appears in that branch, the action consumes a grant inside `prisma.$transaction`, pending creation includes `hashNeonSessionId(primary.sessionId)`, and the grant code is never logged.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/enrollment.test.ts src/app/auth/__tests__/two-factor-setup.test.ts src/app/auth/__tests__/two-factor-lifecycle.test.ts
```

Expected: FAIL on missing activation state/action/form and current automatic secret creation.

- [ ] **Step 3: Replace automatic enrollment with a two-stage state machine**

Remove `getOrCreatePendingEnrollment()`. `getEnrollmentSetupState()` queries only credential metadata first. It decrypts `encryptedSecret` only after verifying `PENDING`, future `setupExpiresAt`, and a timing-safe-equal session hash matching `hashNeonSessionId(primary.sessionId)`.

`startPendingEnrollmentWithActivationCode()`:

1. reloads the active user and enforces `sessionCreatedAt > twoFactorResetAt`;
2. validates and hashes the supplied activation code;
3. applies existing user-session/IP rate limits;
4. generates and encrypts a TOTP secret outside the transaction;
5. inside one Prisma transaction consumes the grant, deletes old pending credentials, creates the bound pending credential, and calls `logAuditRequired()` with summary `Înrolare 2FA autorizată`;
6. records a generic activation failure when the grant does not match and clears the current session limit after success.

Use a dedicated `InvalidEnrollmentActivationCodeError` whose public message is `Codul de activare nu este valid sau a expirat.`

- [ ] **Step 4: Render activation gate and update server actions**

Add `activationCode` to the neutral form-state module. The client form uses `useActionState`, `autoComplete="one-time-code"`, and explains that the administrator supplies the code separately. The setup page branches before calling QRCode:

```tsx
if (setup.kind === "ACTIVATION_REQUIRED") {
  return <TwoFactorShell title="Activează configurarea 2FA" ...><ActivationForm /></TwoFactorShell>;
}
const qrDataUrl = await QRCode.toDataURL(setup.enrollment.uri, ...);
```

The activation action redirects to `/auth/2fa/setup` only on success. Keep all runtime exports from the `"use server"` file async.

- [ ] **Step 5: Bind regeneration and TOTP confirmation to the same session**

`regeneratePendingEnrollment()` must require the exact stored session hash and preserve the original `setupExpiresAt`. `confirmPendingEnrollment()` adds the same binding to its credential query and activation `updateMany`, clears `enrollmentAuthSessionHash`, and writes `2FA activat` through `logAuditRequired()` in the same transaction as the status update.

- [ ] **Step 6: Run focused GREEN verification**

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/enrollment.test.ts src/app/auth/__tests__/two-factor-setup.test.ts src/app/auth/__tests__/two-factor-lifecycle.test.ts src/lib/auth/two-factor/__tests__/rate-limit.test.ts
pnpm exec tsc --noEmit
pnpm exec eslint src/lib/auth/two-factor/enrollment.ts src/app/auth/2fa/actions.ts src/app/auth/2fa/form-state.ts src/app/auth/2fa/setup/page.tsx src/app/auth/2fa/setup/activation-form.tsx src/app/auth/2fa/setup/setup-form.tsx
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/two-factor/enrollment.ts src/lib/auth/two-factor/__tests__/enrollment.test.ts src/app/auth/2fa/actions.ts src/app/auth/2fa/form-state.ts src/app/auth/2fa/setup/page.tsx src/app/auth/2fa/setup/activation-form.tsx src/app/auth/2fa/setup/setup-form.tsx src/app/auth/__tests__/two-factor-setup.test.ts src/app/auth/__tests__/two-factor-lifecycle.test.ts
git diff --cached --check
git commit -m "feat: require administrator code before TOTP enrollment"
```

---

### Task 4: Administrator issuance, reset, and one-time reveal UI

**Files:**
- Modify: `src/lib/staff/queries.ts`
- Modify: `src/lib/staff/validate.ts`
- Modify: `src/app/staff/actions.ts`
- Modify: `src/app/staff/staff-dialogs.tsx`
- Modify: `src/app/crm/page.tsx`
- Modify: `src/lib/staff/__tests__/two-factor-reset.test.ts`
- Modify: `src/app/staff/__tests__/two-factor-admin-ui.test.ts`
- Create: `src/lib/staff/__tests__/two-factor-activation.test.ts`

**Interfaces:**
- Extends: `StaffActionState` with `revealedActivationCode?: string`, `activationExpiresAt?: string`, and `warning?: boolean`
- Produces: `issueStaffTwoFactorActivationAction(previous, formData): Promise<StaffActionState>`
- Changes: successful reset also issues and reveals a replacement activation code

- [ ] **Step 1: Write failing admin action and UI tests**

Test exact target validation, admin authorization, self-issue rejection, active-credential rejection, transaction use, `replaceEnrollmentGrant()`, and required audit. Extend reset tests to require new grant issuance in the reset transaction and a revealed code in both full-success and Neon partial-failure results.

Source-test the UI for `Emite cod 2FA`, the single-reveal warning, expiry display, copy button, separate-channel instruction, and hiding both issue/reset controls for `user.id === currentUserId`.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec tsx --env-file=.env --test src/lib/staff/__tests__/two-factor-activation.test.ts src/lib/staff/__tests__/two-factor-reset.test.ts src/app/staff/__tests__/two-factor-admin-ui.test.ts
```

- [ ] **Step 3: Implement the issue action and required audit**

Parse `userId` and exact stored username. Reload the target with credential status. Refuse inactive, username-less, self, or `ACTIVE` targets. In one transaction call `replaceEnrollmentGrant()` and `logAuditRequired()` with details limited to `{ username, enrollmentGrantIssued: true, expiresAt }`. Return the plaintext code and ISO expiry only in action state, then revalidate `/crm`.

- [ ] **Step 4: Extend reset and status query**

Inside the existing reset transaction call `resetTwoFactorCredential()`, then `replaceEnrollmentGrant()`, then one required audit describing reset and grant issuance. Preserve the resulting plaintext in memory and return it after Neon revocation. If revocation fails, return `ok: false`, `warning: true`, and the same reveal fields.

Include only grant `expiresAt` in `getStaffData()`. Derive statuses `ACTIVE`, `PENDING`, `CODE_ISSUED`, and `NOT_CONFIGURED`; expired grants display as `NOT_CONFIGURED`.

- [ ] **Step 5: Build the one-time reveal drawers**

Add `IssueTwoFactorActivationDialog` for non-active users and reuse one `RevealedActivationCode` component from both issue and reset drawers. It displays the code, expiry, copy button, and `Comunică acest cod separat, ideal personal. După închiderea ferestrei nu mai poate fi afișat.` The reset drawer keeps exact-username confirmation.

- [ ] **Step 6: Run focused GREEN verification**

```bash
pnpm exec tsx --env-file=.env --test src/lib/staff/__tests__/two-factor-activation.test.ts src/lib/staff/__tests__/two-factor-reset.test.ts src/app/staff/__tests__/two-factor-admin-ui.test.ts
pnpm exec tsc --noEmit
pnpm exec eslint src/lib/staff/queries.ts src/lib/staff/validate.ts src/app/staff/actions.ts src/app/staff/staff-dialogs.tsx src/app/crm/page.tsx
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/staff/queries.ts src/lib/staff/validate.ts src/app/staff/actions.ts src/app/staff/staff-dialogs.tsx src/app/crm/page.tsx src/lib/staff/__tests__/two-factor-activation.test.ts src/lib/staff/__tests__/two-factor-reset.test.ts src/app/staff/__tests__/two-factor-admin-ui.test.ts
git diff --cached --check
git commit -m "feat: let administrators issue TOTP activation codes"
```

---

### Task 5: Invalidate activation grants on account security changes

**Files:**
- Modify: `src/app/account/actions.ts`
- Modify: `src/app/staff/actions.ts`
- Modify: `src/app/auth/__tests__/two-factor-lifecycle.test.ts`

**Interfaces:**
- Consumes: `clearEnrollmentGrant()` from Task 2
- Guarantees: password change, administrator password reset, and deactivation remove every outstanding enrollment grant before external identity mutation

- [ ] **Step 1: Write failing lifecycle source tests**

Require `clearEnrollmentGrant(tx, current.id)` inside the own-password transaction. Require target grant cleanup in administrator password reset before `setAuthPassword` or identity migration. Require deactivation cleanup in the same local transaction as `active: false`, trusted-device cleanup, and proof cleanup. Assert reactivation does not call `replaceEnrollmentGrant()`.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec tsx --env-file=.env --test src/app/auth/__tests__/two-factor-lifecycle.test.ts
```

- [ ] **Step 3: Add cleanup to all three transactions**

Import `clearEnrollmentGrant`. Add it without changing current proof-preservation semantics for own password change. Administrator password reset continues clearing proofs and trusted devices. Deactivation clears grant, proofs, and devices before Neon ban/revocation.

- [ ] **Step 4: Run and verify GREEN**

```bash
pnpm exec tsx --env-file=.env --test src/app/auth/__tests__/two-factor-lifecycle.test.ts
pnpm exec eslint src/app/account/actions.ts src/app/staff/actions.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/account/actions.ts src/app/staff/actions.ts src/app/auth/__tests__/two-factor-lifecycle.test.ts
git diff --cached --check
git commit -m "feat: invalidate TOTP activation codes on account changes"
```

---

### Task 6: Break-glass reset and activation-code issuance

**Files:**
- Modify: `scripts/reset-staff-2fa.ts`
- Modify: `src/lib/staff/__tests__/break-glass.test.ts`
- Modify: `docs/runbooks/two-factor-authentication.md`

**Interfaces:**
- Consumes: `replaceEnrollmentGrant()` and `resetTwoFactorCredential()`
- Guarantees: interactive break-glass always issues one fresh activation code after local reset and never prints secret material other than the explicitly intended one-time code

- [ ] **Step 1: Write failing break-glass source and safe-command tests**

Keep parser tests. Add source assertions that reset and grant replacement occur in the same Prisma transaction, audit details contain `breakGlass: true` and `enrollmentGrantIssued: true`, the code is printed only after the transaction, and revocation occurs after that print. Assert no `--force` path. Run `pnpm staff:reset-2fa --help` as the only executable smoke test.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec tsx --env-file=.env --test src/lib/staff/__tests__/break-glass.test.ts
```

- [ ] **Step 3: Issue and reveal the code after local commit**

Inside the existing transaction reset the credential, replace the grant, and write the required `BREAK_GLASS` audit with the supplied reason but no code/hash. Store the returned plaintext only in a local variable. After commit print the target and code once, then revoke Neon sessions. On revocation failure print a high-level warning and exit non-zero while retaining the successful local state.

- [ ] **Step 4: Update the runbook**

Document the 15-minute activation code, separate-channel delivery, normal issue/reset flow, expired/replaced codes, session binding, sole-admin CLI output, partial revocation, schema rollout, and the rule that old pending credentials cannot expose QR codes.

- [ ] **Step 5: Run safe GREEN verification**

```bash
pnpm exec tsx --env-file=.env --test src/lib/staff/__tests__/break-glass.test.ts
pnpm staff:reset-2fa --help
pnpm exec eslint scripts/reset-staff-2fa.ts
```

- [ ] **Step 6: Commit**

```bash
git add scripts/reset-staff-2fa.ts src/lib/staff/__tests__/break-glass.test.ts docs/runbooks/two-factor-authentication.md
git diff --cached --check
git commit -m "feat: issue activation codes during break-glass recovery"
```

---

### Task 7: Full security audit and end-to-end verification

**Files:**
- Verify: every file changed in Tasks 1-6
- Modify only if a verification failure proves a defect in scope

**Interfaces:**
- Proves the complete approved specification rather than only individual helper behavior

- [ ] **Step 1: Run a source security audit**

Search for every TOTP secret creation/decryption call and prove it is reachable only after a bound pending credential exists:

```bash
rg -n "createTotpEnrollment|decryptTotpSecret|encryptedSecret|QRCode.toDataURL" src
rg -n "activationCode|EnrollmentGrant|tokenHash" src scripts docs/runbooks/two-factor-authentication.md
```

Inspect every result. Confirm no logs, audit details, URLs, or client props contain activation hashes, raw session IDs, cookies, database URLs, or TOTP secrets beyond the intentional server-to-setup-form manual key after authorization.

- [ ] **Step 2: Run all automated verification**

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec prisma validate
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
git diff --check
```

Expected: all tests pass with zero failures, lint exits 0, production build succeeds, Prisma is valid, database diff is empty, and Git diff check is empty.

- [ ] **Step 3: Verify the live development flow without destructive break-glass smoke tests**

With `pnpm dev` and a test user on the configured development Neon database, verify:

1. password/Google alone shows only the activation form;
2. page source and browser console contain no QR URI or secret before activation;
3. wrong code is generic and rate-limited;
4. administrator issuance reveals one 15-minute code;
5. replacement makes the old code fail;
6. correct code reveals QR only in the consuming session;
7. a second primary session cannot see or activate that pending QR;
8. regeneration keeps the original expiry;
9. TOTP confirmation opens CRM;
10. reset signs the test user out and issues a new code;
11. the current administrator has no self-issue/reset controls;
12. public `/catalog` and `/ru/catalog` remain available.

Do not mutate a production account and do not execute break-glass merely as a smoke test.

- [ ] **Step 4: Run completion evidence and commit any verification-only fix**

If Step 2 or Step 3 exposed an in-scope defect, reproduce it with a failing test, implement only that fix, rerun Step 2, and commit with a precise `fix:` message. Otherwise require a clean working tree:

```bash
git status --short --branch
git log --oneline --decorate -10
```

Expected: `main` is clean and contains all six feature commits plus the design and plan commits.
