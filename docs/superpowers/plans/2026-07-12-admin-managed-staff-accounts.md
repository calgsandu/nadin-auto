# Admin-Managed Staff Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace public registration with administrator-created, username/password staff accounts that can be reset, deactivated, reactivated, and optionally changed by their owner.

**Architecture:** Keep Neon Auth as the password/session authority and Prisma `AppUser` as the application authorization authority. Resolve a submitted username to the stored technical email on the server, reject every session without an active pre-provisioned `AppUser`, and use Neon Auth admin operations for lifecycle changes.

**Tech Stack:** Next.js 16 Server Actions and Route Handlers, React 19, Neon Auth 0.4.1-beta, Prisma 7/PostgreSQL, TypeScript tests executed with `tsx`.

## Global Constraints

- Public sign-up and Google authentication must not appear or grant panel access.
- Passwords must never be stored in Prisma, audit details, logs, URLs, or recoverable UI state.
- Usernames are lowercase, 3–32 characters, and contain only `a-z`, `0-9`, `.`, `_`, or `-`.
- Password change at first login is optional.
- Staff accounts are deactivated rather than deleted.
- The last active administrator and the current administrator cannot be deactivated.
- Preserve all unrelated dirty-worktree changes.

---

### Task 1: Username and staff lifecycle domain rules

**Files:**
- Create: `src/lib/auth/username.ts`
- Modify: `src/lib/roles.ts`
- Create: `src/lib/__tests__/username.test.ts`
- Modify: `src/lib/__tests__/roles.test.ts`

**Interfaces:**
- Produces: `normalizeUsername(value: string): string`, `validateUsername(value: string): string | null`, `technicalEmailForUsername(username: string): string`.
- Produces: `wouldDeactivateLastAdmin(users, targetUserId): boolean` for rows shaped as `{ id, role, active }`.

- [ ] **Step 1: Write failing username and active-admin tests**

```ts
assert.equal(normalizeUsername(" Ion.Popescu "), "ion.popescu");
assert.equal(validateUsername("ab"), "Numele de utilizator trebuie să aibă între 3 și 32 de caractere.");
assert.equal(validateUsername("ion popescu"), "Folosește doar litere mici, cifre, punct, cratimă sau underscore.");
assert.equal(technicalEmailForUsername("ion"), "ion@staff.nadinauto.invalid");
assert.equal(wouldDeactivateLastAdmin([{ id: "a", role: "ADMIN", active: true }], "a"), true);
```

- [ ] **Step 2: Run tests and confirm missing exports fail**

Run: `pnpm tsx src/lib/__tests__/username.test.ts && pnpm tsx src/lib/__tests__/roles.test.ts`

Expected: failure because the new helpers do not exist.

- [ ] **Step 3: Implement pure helpers**

```ts
const USERNAME_RE = /^[a-z0-9._-]+$/;
export const normalizeUsername = (value: string) => value.trim().toLowerCase();
export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (username.length < 3 || username.length > 32) return "Numele de utilizator trebuie să aibă între 3 și 32 de caractere.";
  if (!USERNAME_RE.test(username)) return "Folosește doar litere mici, cifre, punct, cratimă sau underscore.";
  return null;
}
export const technicalEmailForUsername = (username: string) => `${normalizeUsername(username)}@staff.nadinauto.invalid`;
```

Implement the active-admin guard by counting other rows where `role === "ADMIN" && active`.

- [ ] **Step 4: Run both tests and commit**

Run: `pnpm tsx src/lib/__tests__/username.test.ts && pnpm tsx src/lib/__tests__/roles.test.ts`

Expected: both print their success messages.

Commit: `git commit -m "feat: add staff username and lifecycle rules"` with only Task 1 files.

### Task 2: Persist username and account state, then bootstrap existing users

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `scripts/bootstrap-staff-accounts.ts`
- Modify generated files under: `src/generated/prisma/`
- Modify: `package.json`

**Interfaces:**
- `AppUser.username: string | null` is unique during the safe migration phase.
- `AppUser.active: boolean` defaults to `true`.
- Produces command `pnpm staff:bootstrap`.

- [ ] **Step 1: Extend the Prisma schema**

```prisma
model AppUser {
  id         String   @id @default(cuid())
  authUserId String   @unique
  username   String?  @unique
  email      String?
  name       String?
  role       AppRole  @default(ANGAJAT)
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

- [ ] **Step 2: Generate the client and type-check the schema**

Run: `pnpm prisma:generate`

Expected: Prisma client generation succeeds.

- [ ] **Step 3: Implement an idempotent bootstrap script**

The script must:

1. derive each missing username from the email local part or name;
2. normalize it and append `-2`, `-3`, etc. until unique;
3. update `AppUser.username` and preserve `active`;
4. update `neon_auth.user.role` to `admin` only when the linked `AppUser.role` is `ADMIN`;
5. assert at least one active application administrator has a username;
6. print only usernames and counts, never credentials.

Use parameterized Prisma `$executeRaw` for the provider-role update:

```ts
await prisma.$executeRaw`UPDATE neon_auth."user" SET role = 'admin' WHERE id::text = ${user.authUserId}`;
```

- [ ] **Step 4: Add and run the safe migration commands**

Add `"staff:bootstrap": "tsx scripts/bootstrap-staff-accounts.ts"` to `package.json`.

Run: `pnpm db:push && pnpm staff:bootstrap && pnpm staff:bootstrap`

Expected: schema sync succeeds; first bootstrap fills missing usernames; second reports no further username changes; an active admin is confirmed.

- [ ] **Step 5: Commit schema and bootstrap changes**

Commit: `git commit -m "feat: add staff account state and bootstrap"` with schema, script, package file, and generated Prisma files.

### Task 3: Make panel access provisioned-only and sign-in username-only

**Files:**
- Modify: `src/lib/auth/access.ts`
- Modify: `src/lib/users.ts`
- Modify: `src/app/auth/actions.ts`
- Modify: `src/app/auth/form-state.ts`
- Modify: `src/app/auth/login-form.tsx`
- Modify: `src/app/auth/[path]/page.tsx`
- Modify: `src/app/api/auth/[...path]/route.ts`
- Modify: `src/app/auth/__tests__/form-state.test.ts`
- Modify: `src/lib/__tests__/users.test.ts`

**Interfaces:**
- `getCurrentAppUser()` returns `null` for missing or inactive profiles and never creates profiles.
- `authenticateWithUsername` accepts `username` and `password`, resolves the stored email, and calls `auth.signIn.email`.
- The auth proxy returns HTTP 403 for `POST .../sign-up/email`.

- [ ] **Step 1: Update tests for username validation and non-provisioning**

Test blank, malformed, and valid usernames; remove sign-up-specific assertions. Test a pure lookup decision that rejects `undefined` and `{ active: false }` and accepts `{ active: true }`.

- [ ] **Step 2: Run auth tests and confirm failure**

Run: `pnpm tsx src/app/auth/__tests__/form-state.test.ts && pnpm tsx src/lib/__tests__/users.test.ts`

Expected: failure against the old email/sign-up behavior.

- [ ] **Step 3: Replace automatic upsert with an active-profile lookup**

```ts
const appUser = await prisma.appUser.findUnique({ where: { authUserId: session.user.id } });
if (!appUser?.active) return null;
```

Keep the existing return shape and include `username` and `active` in `CurrentAppUser`.

- [ ] **Step 4: Implement generic username sign-in**

Normalize and validate `formData.get("username")`; look up an active user by username; use its stored email for `auth.signIn.email`. Return the same generic message for missing username, inactive account, or bad password: `Nume de utilizator sau parolă greșite.`

- [ ] **Step 5: Remove public registration and Google**

Render only sign-in mode, redirect `/auth/sign-up` to `/auth/sign-in`, remove `authClient.signIn.social`, and remove all sign-up links/copy.

Wrap the auth handler so POST requests whose catch-all path is `sign-up/email` return `Response.json({ error: "Înregistrarea publică este dezactivată." }, { status: 403 })`; delegate every other request to Neon Auth.

- [ ] **Step 6: Run auth tests, lint touched files, and commit**

Run: `pnpm tsx src/app/auth/__tests__/form-state.test.ts && pnpm tsx src/lib/__tests__/users.test.ts && pnpm eslint src/app/auth src/lib/auth src/lib/users.ts 'src/app/api/auth/[...path]/route.ts'`

Expected: tests and lint pass.

Commit: `git commit -m "feat: restrict authentication to provisioned usernames"`.

### Task 4: Add Neon-backed staff administration actions

**Files:**
- Create: `src/lib/staff/validate.ts`
- Create: `src/lib/staff/auth-admin.ts`
- Create: `src/lib/staff/__tests__/validate.test.ts`
- Modify: `src/app/staff/actions.ts`
- Modify: `src/lib/staff/queries.ts`
- Modify: `src/lib/__tests__/roles.test.ts`

**Interfaces:**
- `parseCreateStaffInput(formData)` returns `{ name, username, role, password }` or throws a Romanian validation error.
- `createAuthIdentity`, `setAuthPassword`, `banAuthIdentity`, `unbanAuthIdentity`, `revokeAuthSessions`, and `removeAuthIdentity` wrap `auth.admin.*` and normalize SDK errors.
- Server actions: `createStaffUserAction`, `resetStaffPasswordAction`, `setStaffActiveAction`, and existing `setUserRoleAction`.

- [ ] **Step 1: Write failing validation tests**

Cover invalid username, role, name shorter than 2 characters, password shorter than 8 characters, and a valid form. Verify returned data never adds a second password field.

- [ ] **Step 2: Run the validation test and confirm failure**

Run: `pnpm tsx src/lib/staff/__tests__/validate.test.ts`

Expected: module missing.

- [ ] **Step 3: Implement validation and Neon admin wrappers**

Call the installed SDK methods with these payloads:

```ts
auth.admin.createUser({ email, password, name, role: "user" });
auth.admin.setUserPassword({ userId, newPassword });
auth.admin.banUser({ userId, banReason: "Cont dezactivat de administrator" });
auth.admin.revokeUserSessions({ userId });
auth.admin.unbanUser({ userId });
auth.admin.removeUser({ userId });
```

Every wrapper must throw on `result.error` and must not log its payload.

- [ ] **Step 4: Implement create/reset/active actions with compensation and audit**

Create flow: require app `ADMIN`, validate, reject duplicate username, create Neon identity using `technicalEmailForUsername`, create `AppUser`, audit without password, and remove the Neon identity if Prisma creation fails.

Reset flow: require app `ADMIN`, validate password, call `setUserPassword`, revoke sessions, and audit only `userId`/username.

Deactivate flow: reject self and last active admin; set `active=false` first; ban and revoke; if the provider call fails keep local access blocked and return a synchronization warning. Reactivation must unban first and only then set `active=true`.

- [ ] **Step 5: Remove permanent staff deletion and include inactive users in queries**

Delete `deleteUserAction` and its UI contract. Sort active users before inactive users, then by role and display name.

- [ ] **Step 6: Run staff/role tests, lint, and commit**

Run: `pnpm tsx src/lib/staff/__tests__/validate.test.ts && pnpm tsx src/lib/__tests__/roles.test.ts && pnpm eslint src/app/staff src/lib/staff src/lib/roles.ts`

Expected: tests and lint pass.

Commit: `git commit -m "feat: add administrator-managed staff lifecycle"`.

### Task 5: Build Personal management UI and one-time password display

**Files:**
- Create: `src/app/staff/staff-dialogs.tsx`
- Modify: `src/app/staff/role-form.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- `CreateStaffDialog` opens from the Personal header.
- `ResetPasswordDialog` and `StaffActiveButton` operate per row.
- Successful create/reset state contains the submitted/generated password only until the dialog is closed or reloaded.

- [ ] **Step 1: Add the Personal header action**

Render `<CreateStaffDialog />` only when `activeSectionId === "personal" && canManageStaff(appUser.role)`.

- [ ] **Step 2: Implement accessible create/reset dialogs**

Use native `<dialog>` consistent with existing project dialogs. Include name, username, role, password, a `Generează` button using `crypto.getRandomValues`, and submit pending/error states.

After success render a warning `Copiază parola acum. După închiderea ferestrei nu mai poate fi afișată.` with a copy button. Clear action state and local password when closing.

- [ ] **Step 3: Replace email/delete columns with username/state/lifecycle actions**

Columns become `Nume`, `Utilizator`, `Rol curent`, `Stare`, `Acțiuni`. Show an `Activ` or `Dezactivat` badge. Keep role editing, add reset and activate/deactivate, and do not render self-deactivation.

- [ ] **Step 4: Lint and commit**

Run: `pnpm eslint src/app/staff src/app/page.tsx`

Expected: lint passes.

Commit: `git commit -m "feat: add staff account management interface"`.

### Task 6: Add optional self-service password change

**Files:**
- Create: `src/app/account/actions.ts`
- Create: `src/app/account/change-password-dialog.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/auth/form-state.ts`

**Interfaces:**
- `changeOwnPasswordAction` accepts `currentPassword`, `newPassword`, and `confirmPassword`.
- `ChangePasswordDialog` is available from the signed-in user area.

- [ ] **Step 1: Implement validation for matching new passwords of at least 8 characters**

Return Romanian messages for missing current password, short new password, and mismatch.

- [ ] **Step 2: Verify the current password without exposing the technical email**

Use the current `AppUser.email` with `auth.signIn.email({ email, password: currentPassword })`; on success call `auth.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })`. Return a generic current-password error on failure.

- [ ] **Step 3: Build and expose the dialog**

Use password inputs with correct autocomplete attributes. Clear all fields on success/close and never place password data in a URL.

- [ ] **Step 4: Lint and commit**

Run: `pnpm eslint src/app/account src/app/page.tsx src/app/auth/form-state.ts`

Expected: lint passes.

Commit: `git commit -m "feat: add optional password change"`.

### Task 7: End-to-end verification and hardening

**Files:**
- Modify only files needed to fix failures discovered by the commands below.

**Interfaces:**
- No new public interface.

- [ ] **Step 1: Run all project TypeScript tests**

Run: `for test in $(rg --files src | rg '__tests__/.*\.test\.ts$'); do pnpm tsx "$test" || exit 1; done`

Expected: every test prints its success message.

- [ ] **Step 2: Run generated-client, lint, and production build checks**

Run: `pnpm prisma:generate && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 3: Verify database/bootstrap state**

Run: `pnpm staff:bootstrap`

Expected: at least one active admin with username; no password output; no duplicate usernames.

- [ ] **Step 4: Verify auth surface manually over HTTP**

Start `pnpm dev:http`, then confirm `/auth/sign-in` contains no `Creează cont` or Google text and a POST to `/api/auth/sign-up/email` returns 403. Confirm an inactive or unprovisioned identity is redirected to sign-in.

- [ ] **Step 5: Review password secrecy and dirty-worktree isolation**

Run: `rg -n "console\.(log|error).*password|details:.*password|password.*details:" src scripts` and `git status --short`.

Expected: no password logging/audit matches; unrelated pre-existing catalog/label changes remain untouched.

- [ ] **Step 6: Commit verification fixes, if any**

Commit only implementation files changed for verification with `git commit -m "fix: harden managed staff accounts"`.
