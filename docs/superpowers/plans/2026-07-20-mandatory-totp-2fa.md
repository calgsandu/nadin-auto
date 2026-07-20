# Mandatory TOTP Two-Factor Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require every active Nadin Auto user to complete TOTP authentication after Neon Auth, with 30-day trusted devices, administrator reset, and a safe break-glass command.

**Architecture:** Keep Neon Auth as the username/password and Google identity provider, then add a database-backed application gate. Store TOTP secrets encrypted with AES-256-GCM, store only hashes of opaque proof/device tokens, and make `getCurrentAppUser()` return a user only after both factors are valid.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Neon Auth `0.4.x`, Prisma 7 with Neon Postgres, Node `crypto`, `otpauth` 9.5.1, `qrcode` 1.5.4, Node test runner through `tsx`.

## Global Constraints

- TOTP is mandatory for `ADMIN`, `DIRECTOR`, and `ANGAJAT`, for password and Google login.
- TOTP uses RFC 6238, SHA-1, 6 digits, a 30-second period, issuer `Nadin Auto`, and a validation window of exactly one step in either direction.
- Existing authenticated sessions must enter enrollment immediately after rollout; no account receives an implicit bypass.
- A trusted device is optional, expires exactly 30 days after issuance, and never replaces the Neon Auth first factor.
- Do not generate or store backup codes.
- Store TOTP secrets only as versioned AES-256-GCM ciphertext using `TWO_FACTOR_ENCRYPTION_KEY`.
- Store session-proof and trusted-device browser tokens only as SHA-256 hashes; raw tokens exist only in `HttpOnly` cookies.
- Production cookies are `Secure`, `SameSite=Lax`, `Path=/`, and use the `__Host-` prefix.
- Five user-session failures in ten minutes cause a 15-minute lock; 25 IP failures in ten minutes cause a 15-minute lock.
- Only a fully authenticated `ADMIN` may reset another user's TOTP. UI self-reset is forbidden.
- The break-glass reset is interactive, exact-target, audited, and has no HTTP or non-interactive force path.
- Any database, encryption, token, or unknown-state error fails closed.
- Preserve unrelated changes in the dirty worktree and stage only files listed by the current task.

## File Structure

Create focused modules under `src/lib/auth/two-factor/`:

- `config.ts`: parse and validate 2FA environment secrets and cookie names.
- `crypto.ts`: AES-GCM secret envelope, random tokens, and domain-separated hashes.
- `totp.ts`: generate enrollment material and match a code to an RFC 6238 step.
- `rate-limit.ts`: pure rate-limit transition plus Prisma-backed atomic counters.
- `types.ts`: primary-session and four-state access discriminated unions.
- `primary.ts`: read the Neon session and active `AppUser` without granting app access.
- `session.ts`: issue, validate, rotate, and revoke session-proof/trusted-device records.
- `access-state.ts`: derive the authoritative second-factor state.
- `enrollment.ts`: pending-secret lifecycle and atomic first-code activation.
- `verification.ts`: active-code verification and proof/device issuance.
- `reset.ts`: shared fail-closed invalidation used by password, deactivation, admin, and CLI flows.

Create 2FA routes under `src/app/auth/2fa/` and keep all protected business code behind the existing `src/lib/auth/access.ts` facade.

---

### Task 1: Persistence and cryptographic primitives

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Modify: `prisma/schema.prisma`
- Regenerate: `src/generated/prisma/**`
- Create: `src/lib/auth/two-factor/config.ts`
- Create: `src/lib/auth/two-factor/crypto.ts`
- Create: `src/lib/auth/two-factor/totp.ts`
- Test: `src/lib/auth/two-factor/__tests__/config.test.ts`
- Test: `src/lib/auth/two-factor/__tests__/crypto.test.ts`
- Test: `src/lib/auth/two-factor/__tests__/totp.test.ts`

**Interfaces:**
- Produces: `readTwoFactorConfig(env): TwoFactorConfig`
- Produces: `encryptTotpSecret(secret, key): string`
- Produces: `decryptTotpSecret(envelope, key): string`
- Produces: `generateOpaqueToken(): string`, `hashToken(token): string`, `hashNeonSessionId(id): string`, `hashRateLimitIp(ip, pepper): string`
- Produces: `createTotpEnrollment(username): { secret: string; uri: string }`
- Produces: `matchTotpStep(secret, username, code, timestampMs): number | null`

- [ ] **Step 1: Install the audited TOTP and QR dependencies**

Run:

```bash
pnpm add otpauth@9.5.1 qrcode@1.5.4
pnpm add -D @types/qrcode@1.5.6
```

Expected: `package.json` and `pnpm-lock.yaml` contain exactly these packages; no Better Auth MFA plugin is added.

- [ ] **Step 2: Add the Prisma models and environment contract**

Add the enums and models at schema top level, and insert the four relation fields shown below inside the existing `AppUser` model:

```prisma
enum TwoFactorCredentialStatus {
  PENDING
  ACTIVE
}

enum TwoFactorRateLimitScope {
  USER_SESSION
  IP
}

twoFactorResetAt       DateTime?
twoFactorCredential    TwoFactorCredential?
twoFactorSessionProofs TwoFactorSessionProof[]
trustedDevices         TrustedDevice[]

model TwoFactorCredential {
  id               String                    @id @default(cuid())
  appUserId        String                    @unique
  status           TwoFactorCredentialStatus @default(PENDING)
  encryptedSecret  String
  setupExpiresAt   DateTime?
  verifiedAt       DateTime?
  lastAcceptedStep BigInt?
  appUser          AppUser                   @relation(fields: [appUserId], references: [id], onDelete: Cascade)
  sessionProofs    TwoFactorSessionProof[]
  trustedDevices   TrustedDevice[]
  createdAt        DateTime                   @default(now())
  updatedAt        DateTime                   @updatedAt

  @@index([status, setupExpiresAt])
}

model TwoFactorSessionProof {
  id              String              @id @default(cuid())
  appUserId       String
  credentialId    String
  tokenHash       String              @unique
  authSessionHash String              @unique
  expiresAt       DateTime
  appUser         AppUser             @relation(fields: [appUserId], references: [id], onDelete: Cascade)
  credential      TwoFactorCredential @relation(fields: [credentialId], references: [id], onDelete: Cascade)
  createdAt       DateTime             @default(now())

  @@index([appUserId, expiresAt])
  @@index([credentialId])
}

model TrustedDevice {
  id           String              @id @default(cuid())
  appUserId    String
  credentialId String
  tokenHash    String              @unique
  expiresAt    DateTime
  lastUsedAt   DateTime
  appUser      AppUser             @relation(fields: [appUserId], references: [id], onDelete: Cascade)
  credential   TwoFactorCredential @relation(fields: [credentialId], references: [id], onDelete: Cascade)
  createdAt    DateTime             @default(now())

  @@index([appUserId, expiresAt])
  @@index([credentialId])
}

model TwoFactorRateLimit {
  id            String                  @id @default(cuid())
  scope         TwoFactorRateLimitScope
  keyHash       String
  failures      Int
  windowStarted DateTime
  blockedUntil  DateTime?
  updatedAt     DateTime                @updatedAt

  @@unique([scope, keyHash])
  @@index([blockedUntil])
  @@index([updatedAt])
}
```

Append to `.env.example`:

```dotenv
# 2FA obligatoriu. Fiecare valoare este un secret aleator de 32 bytes, base64.
TWO_FACTOR_ENCRYPTION_KEY=
TWO_FACTOR_RATE_LIMIT_PEPPER=
```

- [ ] **Step 3: Validate and regenerate Prisma before writing domain code**

Run:

```bash
pnpm exec prisma validate
pnpm prisma:generate
```

Expected: both commands exit 0 and generated delegates include `twoFactorCredential`, `twoFactorSessionProof`, `trustedDevice`, and `twoFactorRateLimit`.

- [ ] **Step 4: Write failing configuration, crypto, and TOTP tests**

Create tests with these assertions:

```ts
// config.test.ts
import assert from "node:assert/strict";
import { readTwoFactorConfig } from "@/lib/auth/two-factor/config";

const key = Buffer.alloc(32, 7).toString("base64");
assert.deepEqual(readTwoFactorConfig({
  NODE_ENV: "test",
  TWO_FACTOR_ENCRYPTION_KEY: key,
  TWO_FACTOR_RATE_LIMIT_PEPPER: key,
}).encryptionKey, Buffer.alloc(32, 7));
assert.throws(() => readTwoFactorConfig({}), /TWO_FACTOR_ENCRYPTION_KEY/);
assert.throws(() => readTwoFactorConfig({
  TWO_FACTOR_ENCRYPTION_KEY: "c2hvcnQ=",
  TWO_FACTOR_RATE_LIMIT_PEPPER: key,
}), /32 bytes/);
```

```ts
// crypto.test.ts
import assert from "node:assert/strict";
import {
  decryptTotpSecret, encryptTotpSecret, generateOpaqueToken,
  hashNeonSessionId, hashRateLimitIp, hashToken,
} from "@/lib/auth/two-factor/crypto";

const key = Buffer.alloc(32, 3);
const envelope = encryptTotpSecret("JBSWY3DPEHPK3PXP", key);
assert.equal(decryptTotpSecret(envelope, key), "JBSWY3DPEHPK3PXP");
assert.throws(() => decryptTotpSecret(`${envelope.slice(0, -1)}A`, key));
const token = generateOpaqueToken();
assert.ok(Buffer.from(token, "base64url").byteLength >= 32);
assert.equal(hashToken(token), hashToken(token));
assert.notEqual(hashToken(token), hashNeonSessionId(token));
assert.notEqual(hashRateLimitIp("203.0.113.8", key), hashToken("203.0.113.8"));
```

```ts
// totp.test.ts
import assert from "node:assert/strict";
import * as OTPAuth from "otpauth";
import { createTotpEnrollment, matchTotpStep } from "@/lib/auth/two-factor/totp";

const { secret, uri } = createTotpEnrollment("ion");
assert.match(uri, /^otpauth:\/\/totp\/Nadin%20Auto:ion\?/);
const timestamp = 1_800_000_000_000;
const totp = new OTPAuth.TOTP({ issuer: "Nadin Auto", label: "ion", algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
const code = totp.generate({ timestamp });
assert.equal(matchTotpStep(secret, "ion", code, timestamp), Math.floor(timestamp / 30_000));
assert.equal(matchTotpStep(secret, "ion", "12345", timestamp), null);
assert.equal(matchTotpStep(secret, "ion", code, timestamp + 61_000), null);
```

- [ ] **Step 5: Run the focused tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/config.test.ts src/lib/auth/two-factor/__tests__/crypto.test.ts src/lib/auth/two-factor/__tests__/totp.test.ts
```

Expected: FAIL because the three modules do not exist.

- [ ] **Step 6: Implement the configuration and cryptographic helpers**

Implement `config.ts` with exact-length base64 decoding and environment-specific cookie names:

```ts
export type TwoFactorConfig = {
  encryptionKey: Buffer;
  rateLimitPepper: Buffer;
  proofCookieName: string;
  trustedCookieName: string;
  secureCookies: boolean;
};

function decode32(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing ${name}`);
  const bytes = Buffer.from(value, "base64");
  if (bytes.length !== 32) throw new Error(`${name} must decode to exactly 32 bytes`);
  return bytes;
}

export function readTwoFactorConfig(env: Record<string, string | undefined> = process.env): TwoFactorConfig {
  const production = env.NODE_ENV === "production";
  return {
    encryptionKey: decode32("TWO_FACTOR_ENCRYPTION_KEY", env.TWO_FACTOR_ENCRYPTION_KEY),
    rateLimitPepper: decode32("TWO_FACTOR_RATE_LIMIT_PEPPER", env.TWO_FACTOR_RATE_LIMIT_PEPPER),
    proofCookieName: production ? "__Host-nadin-2fa-session" : "nadin-2fa-session",
    trustedCookieName: production ? "__Host-nadin-trusted-device" : "nadin-trusted-device",
    secureCookies: production,
  };
}
```

Implement `crypto.ts` with a `v1.iv.tag.ciphertext` base64url envelope, a random 12-byte GCM IV, `timingSafeEqual` where hashes are compared, and domain prefixes `token:`, `neon-session:`, and `ip:` before hashing.

- [ ] **Step 7: Implement the TOTP helper**

Use one constructor path so URI generation and verification cannot drift:

```ts
import * as OTPAuth from "otpauth";

const ISSUER = "Nadin Auto";
const PERIOD_MS = 30_000;

function createTotp(username: string, secret: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function createTotpEnrollment(username: string) {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  return { secret, uri: createTotp(username, secret).toString() };
}

export function matchTotpStep(secret: string, username: string, code: string, timestampMs = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = createTotp(username, secret).validate({ token: code, timestamp: timestampMs, window: 1 });
  return delta === null ? null : Math.floor(timestampMs / PERIOD_MS) + delta;
}
```

- [ ] **Step 8: Run focused tests and commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/config.test.ts src/lib/auth/two-factor/__tests__/crypto.test.ts src/lib/auth/two-factor/__tests__/totp.test.ts
pnpm exec prisma validate
git diff --check -- package.json pnpm-lock.yaml .env.example prisma/schema.prisma src/lib/auth/two-factor
```

Expected: all focused tests pass, Prisma validates, and the hand-written diff check is empty. Generated Prisma code is excluded because its generator emits whitespace in documentation comments; the generated client is verified by `prisma validate`, TypeScript, and the build.

Commit:

```bash
git add -p package.json pnpm-lock.yaml .env.example prisma/schema.prisma src/generated/prisma
git add src/lib/auth/two-factor/config.ts src/lib/auth/two-factor/crypto.ts src/lib/auth/two-factor/totp.ts src/lib/auth/two-factor/__tests__/config.test.ts src/lib/auth/two-factor/__tests__/crypto.test.ts src/lib/auth/two-factor/__tests__/totp.test.ts
git diff --cached --check -- . ':(exclude)src/generated/prisma/**'
git diff --cached --name-only
git commit -m "feat: add TOTP persistence and crypto primitives"
```

---

### Task 2: Distributed attempt limiting

**Files:**
- Create: `src/lib/auth/two-factor/rate-limit.ts`
- Test: `src/lib/auth/two-factor/__tests__/rate-limit.test.ts`

**Interfaces:**
- Consumes: `hashNeonSessionId()` and `hashRateLimitIp()` from Task 1
- Produces: `buildRateLimitKeys(userId, sessionId, ip, pepper): RateLimitKey[]`
- Produces: `assertTwoFactorAttemptAllowed(keys, now?): Promise<void>`
- Produces: `recordTwoFactorFailure(keys, now?): Promise<Date | null>`
- Produces: `clearUserSessionRateLimit(key): Promise<void>`
- Produces: `trustedClientIp(headers, env): string | null`
- Throws: `TwoFactorLockedError` with `retryAt: Date`

- [ ] **Step 1: Write failing policy tests**

Test the pure transition separately from Prisma:

```ts
import assert from "node:assert/strict";
import { nextFailureState, rateLimitDecision, USER_SESSION_POLICY, IP_POLICY } from "@/lib/auth/two-factor/rate-limit";

const start = new Date("2026-07-20T10:00:00.000Z");
let state = null;
for (let i = 0; i < 5; i++) state = nextFailureState(state, start, USER_SESSION_POLICY);
assert.equal(state.failures, 5);
assert.equal(state.blockedUntil?.toISOString(), "2026-07-20T10:15:00.000Z");
assert.equal(rateLimitDecision(state, new Date("2026-07-20T10:14:59.000Z")).allowed, false);
assert.equal(rateLimitDecision(state, new Date("2026-07-20T10:15:00.000Z")).allowed, true);

let ipState = null;
for (let i = 0; i < 25; i++) ipState = nextFailureState(ipState, start, IP_POLICY);
assert.equal(ipState.blockedUntil?.toISOString(), "2026-07-20T10:15:00.000Z");
assert.equal(nextFailureState(state, new Date("2026-07-20T10:11:00.000Z"), USER_SESSION_POLICY).failures, 1);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/rate-limit.test.ts`

Expected: FAIL because `rate-limit.ts` does not exist.

- [ ] **Step 3: Implement the pure policy and atomic persistence**

Use these exported policies:

```ts
export const USER_SESSION_POLICY = { maximum: 5, windowMs: 10 * 60_000, blockMs: 15 * 60_000 } as const;
export const IP_POLICY = { maximum: 25, windowMs: 10 * 60_000, blockMs: 15 * 60_000 } as const;
```

`recordTwoFactorFailure()` must update each `(scope, keyHash)` inside a serializable Prisma transaction, retry Prisma `P2034` conflicts up to three times, and return the latest `blockedUntil`. Do not read and then update outside the transaction. `assertTwoFactorAttemptAllowed()` throws before decrypting a TOTP secret when either key is blocked.

Build keys with domain separation:

```ts
export function buildRateLimitKeys(userId: string, sessionId: string, ip: string | null, pepper: Buffer) {
  const keys: RateLimitKey[] = [{ scope: "USER_SESSION", keyHash: hashToken(`rate:user-session:${userId}:${hashNeonSessionId(sessionId)}`) }];
  if (ip) keys.push({ scope: "IP" as const, keyHash: hashRateLimitIp(ip, pepper) });
  return keys;
}
```

Only failures increment buckets. Successful verification deletes the `USER_SESSION` bucket. Cleanup deletes at most 100 rows whose `updatedAt` is older than 24 hours and whose block has expired.

`trustedClientIp()` reads `x-vercel-forwarded-for` only when `VERCEL === "1"`, taking the first normalized address. In non-production local development it may read the first `x-forwarded-for` value. In non-Vercel production it returns `null`, leaving the user-session limit active instead of trusting a spoofable header. This follows Vercel's documented request-header behavior: <https://vercel.com/docs/headers/request-headers.rsc#x-vercel-forwarded-for>.

- [ ] **Step 4: Run tests and commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/rate-limit.test.ts
pnpm exec eslint src/lib/auth/two-factor/rate-limit.ts src/lib/auth/two-factor/__tests__/rate-limit.test.ts
```

Expected: policy tests pass and ESLint exits 0.

Commit:

```bash
git add src/lib/auth/two-factor/rate-limit.ts src/lib/auth/two-factor/__tests__/rate-limit.test.ts
git commit -m "feat: rate limit TOTP verification attempts"
```

---

### Task 3: Primary identity, session proofs, and access state

**Files:**
- Create: `src/lib/auth/two-factor/types.ts`
- Create: `src/lib/auth/two-factor/primary.ts`
- Create: `src/lib/auth/two-factor/session.ts`
- Create: `src/lib/auth/two-factor/access-state.ts`
- Test: `src/lib/auth/two-factor/__tests__/access-state.test.ts`
- Test: `src/lib/auth/two-factor/__tests__/session.test.ts`

**Interfaces:**
- Produces: `PrimaryAuthContext { sessionId, sessionCreatedAt, sessionExpiresAt, authUserId, appUser }`
- Produces: `AuthAccessState` with exactly `UNAUTHENTICATED`, `ENROLLMENT_REQUIRED`, `TOTP_REQUIRED`, and `AUTHENTICATED`
- Produces: `getPrimaryAuthContext(): Promise<PrimaryAuthContext | null>`
- Produces: `issueSessionProof(input): Promise<{ rawToken: string; expiresAt: Date }>`
- Produces: `issueTrustedDevice(input): Promise<{ rawToken: string; expiresAt: Date }>`
- Produces: `twoFactorCookieOptions(expiresAt): cookie options`
- Produces: `validateSessionProof(input): Promise<boolean>`
- Produces: `getAuthAccessState(): Promise<AuthAccessState>`

- [ ] **Step 1: Write failing state-machine tests**

Create a pure `resolveAccessKind()` contract and cover every branch:

```ts
import assert from "node:assert/strict";
import { resolveAccessKind } from "@/lib/auth/two-factor/access-state";

assert.equal(resolveAccessKind({ primary: null, credentialStatus: null, proofValid: false }), "UNAUTHENTICATED");
assert.equal(resolveAccessKind({ primary: { sessionCreatedAt: new Date(20) }, resetAt: new Date(20), credentialStatus: null, proofValid: false }), "UNAUTHENTICATED");
assert.equal(resolveAccessKind({ primary: { sessionCreatedAt: new Date(21) }, resetAt: new Date(20), credentialStatus: null, proofValid: false }), "ENROLLMENT_REQUIRED");
assert.equal(resolveAccessKind({ primary: { sessionCreatedAt: new Date(21) }, resetAt: null, credentialStatus: "PENDING", proofValid: false }), "ENROLLMENT_REQUIRED");
assert.equal(resolveAccessKind({ primary: { sessionCreatedAt: new Date(21) }, resetAt: null, credentialStatus: "ACTIVE", proofValid: false }), "TOTP_REQUIRED");
assert.equal(resolveAccessKind({ primary: { sessionCreatedAt: new Date(21) }, resetAt: null, credentialStatus: "ACTIVE", proofValid: true }), "AUTHENTICATED");
```

Session tests must prove a proof is rejected for a different user, credential, Neon session hash, or expiry.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/access-state.test.ts src/lib/auth/two-factor/__tests__/session.test.ts
```

Expected: FAIL because the access and session modules do not exist.

- [ ] **Step 3: Define the discriminated union and primary reader**

Use this public shape in `types.ts`:

```ts
export type AuthAccessState =
  | { kind: "UNAUTHENTICATED"; reason: "NO_SESSION" | "NO_ACTIVE_APP_USER" | "STALE_AFTER_RESET" }
  | { kind: "ENROLLMENT_REQUIRED"; primary: PrimaryAuthContext; pendingCredentialId: string | null }
  | { kind: "TOTP_REQUIRED"; primary: PrimaryAuthContext; credentialId: string }
  | { kind: "AUTHENTICATED"; primary: PrimaryAuthContext; credentialId: string };
```

`getPrimaryAuthContext()` reads `auth.getSession()`, then `findActiveAppUser(session.user.id)`, and maps `session.session.id`, `createdAt`, and `expiresAt`. It never returns a `CurrentAppUser` authorization result by itself.

- [ ] **Step 4: Implement opaque session-proof persistence**

`issueSessionProof()` generates a new token, hashes it, deletes any prior proof for the same `authSessionHash`, and creates a proof whose expiry is `sessionExpiresAt`. `issueTrustedDevice()` uses the same opaque-token rule and sets expiry to exactly `30 * 24 * 60 * 60_000` after issuance. `twoFactorCookieOptions()` returns `{ httpOnly: true, secure, sameSite: "lax", path: "/", expires }` using Task 1 configuration. `validateSessionProof()` compares all of these fields in one query:

```ts
{
  tokenHash: hashToken(rawToken),
  authSessionHash: hashNeonSessionId(primary.sessionId),
  appUserId: primary.appUser.id,
  credentialId,
  expiresAt: { gt: now },
}
```

Return only a boolean; never return the stored token hash to UI code.

- [ ] **Step 5: Implement the authoritative access-state reader**

`getAuthAccessState()` reads the primary context, credential, and proof cookie. A session with `sessionCreatedAt <= twoFactorResetAt` returns `UNAUTHENTICATED/STALE_AFTER_RESET`. A pending or absent credential returns enrollment. An active credential without a matching proof returns TOTP required.

Do not switch the existing `src/lib/auth/access.ts` facade yet. The enrollment, verification, redirect, and logout routes must exist before Task 7 turns on mandatory enforcement, so every intermediate commit remains usable.

- [ ] **Step 6: Run focused and existing access tests, then commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/access-state.test.ts src/lib/auth/two-factor/__tests__/session.test.ts src/lib/__tests__/users.test.ts src/lib/auth/__tests__/root-destination.test.ts
pnpm exec eslint src/lib/auth/two-factor/types.ts src/lib/auth/two-factor/primary.ts src/lib/auth/two-factor/session.ts src/lib/auth/two-factor/access-state.ts
```

Expected: all focused tests pass and the existing `CurrentAppUser` shape remains accepted.

Commit:

```bash
git add src/lib/auth/two-factor/types.ts src/lib/auth/two-factor/primary.ts src/lib/auth/two-factor/session.ts src/lib/auth/two-factor/access-state.ts src/lib/auth/two-factor/__tests__/access-state.test.ts src/lib/auth/two-factor/__tests__/session.test.ts
git commit -m "feat: gate application access on a TOTP session proof"
```

---

### Task 4: Mandatory enrollment and QR confirmation

**Files:**
- Create: `src/lib/auth/two-factor/enrollment.ts`
- Create: `src/app/auth/2fa/actions.ts`
- Create: `src/app/auth/2fa/two-factor-shell.tsx`
- Create: `src/app/auth/2fa/setup/page.tsx`
- Create: `src/app/auth/2fa/setup/setup-form.tsx`
- Test: `src/lib/auth/two-factor/__tests__/enrollment.test.ts`
- Test: `src/app/auth/__tests__/two-factor-setup.test.ts`

**Interfaces:**
- Consumes: `getPrimaryAuthContext()`, `createTotpEnrollment()`, AES helpers, rate-limit helpers, and `issueSessionProof()`
- Produces: `getOrCreatePendingEnrollment(primary, now?): Promise<TotpEnrollmentView>`
- Produces: `regeneratePendingEnrollment(primary, now?): Promise<TotpEnrollmentView>`
- Produces: `confirmPendingEnrollment(input): Promise<{ proofToken, proofExpiresAt, trustedToken? }>`
- Produces: `confirmTwoFactorEnrollmentAction(previous, formData): Promise<TwoFactorFormState>`
- Produces: `/auth/2fa/setup` with QR, manual key, code input, remember checkbox, regenerate, and logout

- [ ] **Step 1: Write failing pending-enrollment tests**

Test the store through injected dependencies so no production database is required:

```ts
import assert from "node:assert/strict";
import { decidePendingEnrollment } from "@/lib/auth/two-factor/enrollment";

const now = new Date("2026-07-20T12:00:00.000Z");
assert.equal(decidePendingEnrollment(null, now), "CREATE");
assert.equal(decidePendingEnrollment({ status: "PENDING", setupExpiresAt: new Date("2026-07-20T12:14:00.000Z") }, now), "REUSE");
assert.equal(decidePendingEnrollment({ status: "PENDING", setupExpiresAt: new Date("2026-07-20T11:59:59.000Z") }, now), "REPLACE");
assert.equal(decidePendingEnrollment({ status: "ACTIVE", setupExpiresAt: null }, now), "REJECT_ACTIVE");
```

Add source assertions that the setup page calls `QRCode.toDataURL`, renders „Cheie manuală”, includes `rememberDevice`, and never puts `secret` or `otpauth` in a link or redirect.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/enrollment.test.ts src/app/auth/__tests__/two-factor-setup.test.ts
```

Expected: FAIL because the enrollment module and setup route do not exist.

- [ ] **Step 3: Implement the 15-minute pending-secret lifecycle**

`getOrCreatePendingEnrollment()` must:

```ts
const expiresAt = new Date(now.getTime() + 15 * 60_000);
const { secret, uri } = createTotpEnrollment(primary.appUser.username!);
const encryptedSecret = encryptTotpSecret(secret, readTwoFactorConfig().encryptionKey);
```

Reuse an unexpired `PENDING` credential, replace an expired one, and reject an `ACTIVE` credential. `regeneratePendingEnrollment()` always replaces only a pending credential. Both functions return `{ credentialId, secret, uri, expiresAt }`; callers must not log the result.

Require a non-null normalized username. If a legacy active user lacks one, fail closed with „Contul nu are un nume de utilizator configurat. Contactează administratorul.”

Define `TwoFactorFormState` in `src/app/auth/2fa/actions.ts` as `{ ok: boolean; message: string }`. Both setup and verification actions use this exact shape.

- [ ] **Step 4: Implement atomic first-code confirmation**

`confirmPendingEnrollment()` performs this order:

1. verify the primary session is newer than `twoFactorResetAt`;
2. assert user-session and IP rate-limit buckets are open;
3. load the exact pending credential and reject expired setup;
4. decrypt and match the code;
5. on failure, increment both buckets and return the generic error;
6. in a transaction, update only when `id`, `status: PENDING`, and `setupExpiresAt > now`, set `ACTIVE`, `verifiedAt`, `setupExpiresAt: null`, and `lastAcceptedStep`;
7. issue the session proof and optional trusted device after the transaction;
8. clear the user-session rate-limit bucket on success.

The conditional update count must equal one. A second parallel confirmation returns a generic stale-flow error and creates no second credential.

- [ ] **Step 5: Implement the server-rendered QR page and client form**

In `setup/page.tsx`, accept only `ENROLLMENT_REQUIRED`, create/reuse enrollment, and generate the QR on the server:

```ts
const qrDataUrl = await QRCode.toDataURL(enrollment.uri, {
  errorCorrectionLevel: "M",
  margin: 1,
  width: 240,
});
```

Pass only `qrDataUrl`, the manual base32 secret, and `expiresAt.toISOString()` to `SetupForm`. The form uses `inputMode="numeric"`, `pattern="[0-9]{6}"`, `maxLength={6}`, a default-unchecked `rememberDevice` checkbox, and `useActionState(confirmTwoFactorEnrollmentAction, initialState)`. On success the action sets proof/trusted cookies and redirects to `/crm`.

The shared shell must include a form posting to `logoutAction` so a user can change accounts without completing enrollment.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/enrollment.test.ts src/app/auth/__tests__/two-factor-setup.test.ts
pnpm exec eslint src/lib/auth/two-factor/enrollment.ts src/app/auth/2fa/actions.ts src/app/auth/2fa/two-factor-shell.tsx src/app/auth/2fa/setup/page.tsx src/app/auth/2fa/setup/setup-form.tsx
```

Expected: all enrollment and source-integration tests pass.

Commit:

```bash
git add src/lib/auth/two-factor/enrollment.ts src/lib/auth/two-factor/__tests__/enrollment.test.ts src/app/auth/2fa/actions.ts src/app/auth/2fa/two-factor-shell.tsx src/app/auth/2fa/setup/page.tsx src/app/auth/2fa/setup/setup-form.tsx src/app/auth/__tests__/two-factor-setup.test.ts
git commit -m "feat: add mandatory TOTP enrollment"
```

---

### Task 5: TOTP verification and 30-day trusted devices

**Files:**
- Modify: `src/lib/auth/two-factor/session.ts`
- Create: `src/lib/auth/two-factor/verification.ts`
- Create: `src/app/auth/2fa/continue/route.ts`
- Create: `src/app/auth/2fa/verify/page.tsx`
- Create: `src/app/auth/2fa/verify/verify-form.tsx`
- Modify: `src/app/auth/2fa/actions.ts`
- Test: `src/lib/auth/two-factor/__tests__/verification.test.ts`
- Test: `src/lib/auth/two-factor/__tests__/trusted-device.test.ts`
- Test: `src/app/auth/__tests__/two-factor-routing.test.ts`

**Interfaces:**
- Produces: `consumeAndRotateTrustedDevice(input): Promise<{ rawToken: string; expiresAt: Date } | null>`
- Produces: `verifyActiveTotp(input): Promise<{ proofToken, proofExpiresAt, trustedToken? }>`
- Produces: `verifyTwoFactorAction(previous, formData): Promise<TwoFactorFormState>`
- Produces: `GET /auth/2fa/continue` as the only post-first-factor dispatcher

- [ ] **Step 1: Write failing verification and trusted-token tests**

Cover matching and replay with a pure acceptance helper:

```ts
import assert from "node:assert/strict";
import { canConsumeTotpStep } from "@/lib/auth/two-factor/verification";

assert.equal(canConsumeTotpStep(null, 100), true);
assert.equal(canConsumeTotpStep(99n, 100), true);
assert.equal(canConsumeTotpStep(100n, 100), false);
assert.equal(canConsumeTotpStep(101n, 100), false);
```

Trusted-device tests must assert exactly 30 days, rejection for wrong user/credential, rejection at `expiresAt`, and single-use rotation: after a successful consume the previous token hash is absent and the returned token hash is present.

Routing source tests must assert explicit destinations for all four states and that `STALE_AFTER_RESET` signs out before redirecting to `/auth/sign-in`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/verification.test.ts src/lib/auth/two-factor/__tests__/trusted-device.test.ts src/app/auth/__tests__/two-factor-routing.test.ts
```

Expected: FAIL because verification, trusted-device rotation, and routes are absent.

- [ ] **Step 3: Implement trusted-device issuance and rotation**

Use `30 * 24 * 60 * 60_000` exactly. A consume transaction must delete the presented token with a conditional `deleteMany` matching token hash, user, credential, and `expiresAt > now`; only a delete count of one may create the replacement token. This makes two parallel consumes yield at most one valid replacement.

Use `twoFactorCookieOptions()` from Task 3. Never place the raw token in Prisma data or logs.

- [ ] **Step 4: Implement active TOTP verification**

`verifyActiveTotp()` repeats the primary-user check, applies rate limits before decrypting, validates the active credential, and consumes `lastAcceptedStep` atomically:

```ts
const consumed = await tx.twoFactorCredential.updateMany({
  where: {
    id: credential.id,
    status: "ACTIVE",
    OR: [{ lastAcceptedStep: null }, { lastAcceptedStep: { lt: BigInt(step) } }],
  },
  data: { lastAcceptedStep: BigInt(step) },
});
if (consumed.count !== 1) throw new InvalidTotpCodeError();
```

On success issue a session proof and, only when `rememberDevice === true`, a trusted device. On every code failure increment rate-limit buckets and return „Codul nu este valid sau a expirat.”

- [ ] **Step 5: Implement the verification page and continue route**

`verify/page.tsx` renders only for `TOTP_REQUIRED`; other states redirect through `/auth/2fa/continue`. The form mirrors the six-digit restrictions from setup and keeps the remember checkbox default-unchecked.

`continue/route.ts` uses this exhaustive switch:

```ts
switch (state.kind) {
  case "UNAUTHENTICATED":
    if (state.reason === "STALE_AFTER_RESET") await auth.signOut();
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  case "ENROLLMENT_REQUIRED":
    return NextResponse.redirect(new URL("/auth/2fa/setup", request.url));
  case "AUTHENTICATED":
    return NextResponse.redirect(new URL("/crm", request.url));
  case "TOTP_REQUIRED": {
    const config = readTwoFactorConfig();
    const trustedToken = request.cookies.get(config.trustedCookieName)?.value ?? null;
    const rotated = trustedToken
      ? await consumeAndRotateTrustedDevice({
          rawToken: trustedToken,
          appUserId: state.primary.appUser.id,
          credentialId: state.credentialId,
          now: new Date(),
        })
      : null;
    if (!rotated) {
      const response = NextResponse.redirect(new URL("/auth/2fa/verify", request.url));
      if (trustedToken) response.cookies.delete(config.trustedCookieName);
      return response;
    }
    const proof = await issueSessionProof({
      appUserId: state.primary.appUser.id,
      credentialId: state.credentialId,
      authSessionId: state.primary.sessionId,
      sessionExpiresAt: state.primary.sessionExpiresAt,
    });
    const response = NextResponse.redirect(new URL("/crm", request.url));
    response.cookies.set(config.proofCookieName, proof.rawToken, twoFactorCookieOptions(proof.expiresAt));
    response.cookies.set(config.trustedCookieName, rotated.rawToken, twoFactorCookieOptions(rotated.expiresAt));
    return response;
  }
}
```

Set cookies on the returned `NextResponse`; do not try to mutate cookies during a Server Component render.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/verification.test.ts src/lib/auth/two-factor/__tests__/trusted-device.test.ts src/app/auth/__tests__/two-factor-routing.test.ts
pnpm exec eslint src/lib/auth/two-factor/session.ts src/lib/auth/two-factor/verification.ts src/app/auth/2fa/actions.ts src/app/auth/2fa/continue/route.ts src/app/auth/2fa/verify/page.tsx src/app/auth/2fa/verify/verify-form.tsx
```

Expected: verification, replay, trusted-device, and routing tests pass.

Commit:

```bash
git add src/lib/auth/two-factor/session.ts src/lib/auth/two-factor/verification.ts src/lib/auth/two-factor/__tests__/verification.test.ts src/lib/auth/two-factor/__tests__/trusted-device.test.ts src/app/auth/2fa/actions.ts src/app/auth/2fa/continue/route.ts src/app/auth/2fa/verify/page.tsx src/app/auth/2fa/verify/verify-form.tsx src/app/auth/__tests__/two-factor-routing.test.ts
git commit -m "feat: verify TOTP and remember trusted devices"
```

---

### Task 6: First-factor redirects and logout hygiene

**Files:**
- Modify: `src/app/auth/actions.ts`
- Modify: `src/app/auth/login-form.tsx`
- Modify: `src/app/auth/auth-callback.tsx`
- Modify: `src/app/auth/logout.ts`
- Modify: `src/app/auth/__tests__/logout.test.ts`
- Modify: `src/app/auth/__tests__/form-state.test.ts`
- Create: `src/app/auth/__tests__/two-factor-login-routing.test.ts`

**Interfaces:**
- Consumes: `/auth/2fa/continue` from Task 5
- Produces: both password and Google first factors always land on `/auth/2fa/continue`
- Produces: logout deletes the current session proof and proof cookie, but preserves a valid trusted-device cookie

- [ ] **Step 1: Write failing redirect and logout-order tests**

Update the logout dependency test to require this order:

```ts
const calls: string[] = [];
await performLogout({
  clearSecondFactor: async () => calls.push("clearSecondFactor"),
  signOut: async () => calls.push("signOut"),
  redirect: (path) => calls.push(`redirect:${path}`),
});
assert.deepEqual(calls, ["clearSecondFactor", "signOut", "redirect:/auth/sign-in"]);
```

Add a second case where `clearSecondFactor` throws and assert `signOut` and redirect still occur. Capture the cleanup error with an injected `reportCleanupError(error)` callback so the test proves fail-closed ordering without inspecting console output.

Source assertions must match `callbackURL: "/auth/2fa/continue"`, the password action's final `redirect("/auth/2fa/continue")`, and the Google callback's `window.location.assign("/auth/2fa/continue")`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/app/auth/__tests__/logout.test.ts src/app/auth/__tests__/form-state.test.ts src/app/auth/__tests__/two-factor-login-routing.test.ts
```

Expected: FAIL on the old `/` destinations and missing proof cleanup.

- [ ] **Step 3: Route both login methods through the dispatcher**

Change password login to:

```ts
const result = await auth.signIn.email({
  email: appUser.email,
  password,
  callbackURL: "/auth/2fa/continue",
});
// existing generic credential error handling remains
redirect("/auth/2fa/continue");
```

Change Google `callbackURL` to `/auth/callback`; after the verifier exchange succeeds, assign `/auth/2fa/continue` instead of `/`. Keep signup prevention and existing generic errors unchanged.

- [ ] **Step 4: Clear only the session proof on normal logout**

Extend `performLogout()` with `clearSecondFactor` and `reportCleanupError`. `performLogout()` catches only the second-factor cleanup failure, reports it, then always awaits Neon `signOut` and redirects. `logoutAction()` obtains the current proof cookie, deletes its matching `TwoFactorSessionProof`, and clears the proof cookie. Clear the browser cookie in a `finally` block so a Prisma error cannot leave it present. The reporter logs only `"[2fa] logout cleanup failed"` plus the error object, never token values.

Do not delete `TrustedDevice` or its cookie on ordinary logout.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/app/auth/__tests__/logout.test.ts src/app/auth/__tests__/form-state.test.ts src/app/auth/__tests__/two-factor-login-routing.test.ts
pnpm exec eslint src/app/auth/actions.ts src/app/auth/login-form.tsx src/app/auth/auth-callback.tsx src/app/auth/logout.ts
```

Expected: all auth routing and logout-order tests pass.

Commit:

```bash
git add -p src/app/auth/actions.ts src/app/auth/login-form.tsx src/app/auth/auth-callback.tsx src/app/auth/logout.ts src/app/auth/__tests__/logout.test.ts src/app/auth/__tests__/form-state.test.ts
git add src/app/auth/__tests__/two-factor-login-routing.test.ts
git diff --cached --check
git commit -m "feat: route all sign-ins through the TOTP gate"
```

---

### Task 7: Enforce the gate on every internal entry point

**Files:**
- Modify: `src/lib/auth/access.ts`
- Modify: `src/lib/auth/root-destination.ts`
- Modify: `src/lib/auth/__tests__/root-destination.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/crm/page.tsx`
- Modify: `src/app/print/labels/page.tsx`
- Verify: every other `src/app/api/**/route.ts` and `src/app/**/actions.ts`
- Create: `src/app/auth/__tests__/two-factor-enforcement.test.ts`

**Interfaces:**
- Produces: `resolveRootDestination(kind): "/catalog" | "/auth/2fa/setup" | "/auth/2fa/verify" | "/crm"`
- Produces: `requireCurrentAppUser()` as the single mutation/export authorization facade
- Guarantees: first factor alone cannot reach protected reads or writes

- [ ] **Step 1: Write a failing route-destination matrix**

Replace the old user/null destination test with:

```ts
import assert from "node:assert/strict";
import { resolveRootDestination } from "@/lib/auth/root-destination";

assert.equal(resolveRootDestination("UNAUTHENTICATED"), "/catalog");
assert.equal(resolveRootDestination("ENROLLMENT_REQUIRED"), "/auth/2fa/setup");
assert.equal(resolveRootDestination("TOTP_REQUIRED"), "/auth/2fa/verify");
assert.equal(resolveRootDestination("AUTHENTICATED"), "/crm");
```

Create an enforcement source test that enumerates protected route handlers and confirms each imports `requireCurrentAppUser` or `getCurrentAppUser`. It must also assert that `crm/page.tsx` and `print/labels/page.tsx` redirect via `getAuthAccessState()` before their first data query.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/__tests__/root-destination.test.ts src/app/auth/__tests__/two-factor-enforcement.test.ts
```

Expected: FAIL because root still maps only user/null and pages do not distinguish enrollment from verification.

- [ ] **Step 3: Add exhaustive destination helpers**

Implement:

```ts
export function resolveRootDestination(kind: AuthAccessState["kind"]) {
  switch (kind) {
    case "UNAUTHENTICATED": return "/catalog" as const;
    case "ENROLLMENT_REQUIRED": return "/auth/2fa/setup" as const;
    case "TOTP_REQUIRED": return "/auth/2fa/verify" as const;
    case "AUTHENTICATED": return "/crm" as const;
  }
}
```

`src/app/page.tsx` reads `getAuthAccessState()` and redirects with this helper. `crm/page.tsx` and `print/labels/page.tsx` redirect incomplete users to `/auth/2fa/continue`, while unauthenticated users continue to `/auth/sign-in` or the public catalog according to existing UX.

Switch `src/lib/auth/access.ts` only now, after every 2FA route exists:

```ts
export async function getCurrentAppUser(): Promise<CurrentAppUser | null> {
  const state = await getAuthAccessState();
  if (state.kind !== "AUTHENTICATED") return null;
  const appUser = state.primary.appUser;
  return {
    id: appUser.id,
    role: appUser.role,
    name: appUser.name,
    email: appUser.email,
    username: appUser.username,
    active: true,
    mode: "authenticated",
  };
}

export async function requireCurrentAppUser() {
  const user = await getCurrentAppUser();
  if (!user) throw new Error("Trebuie să finalizezi autentificarea în doi pași.");
  return user;
}
```

- [ ] **Step 4: Audit every protected handler and action**

Run:

```bash
find src/app/api -name route.ts -print0 | xargs -0 rg --files-without-match "requireCurrentAppUser|getCurrentAppUser|getPrimaryAuthContext"
find src/app -name actions.ts -print0 | xargs -0 rg --files-without-match "requireCurrentAppUser|getCurrentAppUser|requireStaffAdmin|getPrimaryAuthContext"
```

Expected exclusions are only `src/app/api/auth/[...path]/route.ts`, `src/app/auth/actions.ts` (first-factor login/logout), and `src/app/auth/2fa/actions.ts` (which calls `getPrimaryAuthContext()` itself). Add `requireCurrentAppUser()` before any protected Prisma read or mutation found by the audit. Keep public catalog query code outside this list.

- [ ] **Step 5: Run enforcement and regression tests, then commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/__tests__/root-destination.test.ts src/app/auth/__tests__/two-factor-enforcement.test.ts src/app/__tests__/catalog-layout.test.ts src/app/__tests__/proxy-location.test.ts
pnpm exec eslint src/lib/auth/access.ts src/lib/auth/root-destination.ts src/app/page.tsx src/app/crm/page.tsx src/app/print/labels/page.tsx
```

Expected: the destination matrix, protected-entry inventory, public catalog, and proxy regressions pass.

Commit only the audited files that changed:

```bash
git add -p src/lib/auth/access.ts src/lib/auth/root-destination.ts src/lib/auth/__tests__/root-destination.test.ts src/app/page.tsx src/app/crm/page.tsx src/app/print/labels/page.tsx
git add src/app/auth/__tests__/two-factor-enforcement.test.ts
git diff --cached --check
git commit -m "feat: enforce TOTP across protected application access"
```

---

### Task 8: Password and account-lifecycle invalidation

**Files:**
- Create: `src/lib/auth/two-factor/reset.ts`
- Modify: `src/app/account/actions.ts`
- Modify: `src/app/staff/actions.ts`
- Test: `src/lib/auth/two-factor/__tests__/reset.test.ts`
- Create: `src/app/auth/__tests__/two-factor-lifecycle.test.ts`

**Interfaces:**
- Produces: `clearTrustedDevices(tx, appUserId): Promise<void>`
- Produces: `clearSecondFactorSessions(tx, appUserId): Promise<void>`
- Produces: `resetTwoFactorCredential(tx, appUserId, resetAt): Promise<void>`
- Guarantees: password changes, password resets, deactivation, and reactivation follow the approved invalidation matrix

- [ ] **Step 1: Write failing reset-service and lifecycle tests**

Use an injected fake transaction to assert exact operations:

```ts
import assert from "node:assert/strict";
import { resetTwoFactorCredential } from "@/lib/auth/two-factor/reset";

const calls: string[] = [];
await resetTwoFactorCredential({
  twoFactorCredential: { deleteMany: async () => { calls.push("credential"); return { count: 1 }; } },
  twoFactorSessionProof: { deleteMany: async () => { calls.push("proofs"); return { count: 1 }; } },
  trustedDevice: { deleteMany: async () => { calls.push("devices"); return { count: 1 }; } },
  appUser: { update: async () => { calls.push("resetAt"); return {}; } },
}, "user_1", new Date(100));
assert.deepEqual(calls, ["proofs", "devices", "credential", "resetAt"]);
```

The source lifecycle test must assert:

- own password change clears trusted devices but preserves the current proof;
- administrator password reset clears trusted devices and all proofs before external password replacement;
- deactivation sets `active: false`, clears devices/proofs, then bans and revokes Neon sessions;
- reactivation does not recreate a trusted device;
- none of these flows deletes an active TOTP credential except the explicit 2FA reset.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/reset.test.ts src/app/auth/__tests__/two-factor-lifecycle.test.ts
```

Expected: FAIL because the shared invalidation service and lifecycle calls are missing.

- [ ] **Step 3: Implement focused invalidation operations**

Use one transaction client interface and keep operations explicit:

```ts
export async function clearTrustedDevices(tx: TwoFactorResetClient, appUserId: string) {
  await tx.trustedDevice.deleteMany({ where: { appUserId } });
}

export async function clearSecondFactorSessions(tx: TwoFactorResetClient, appUserId: string) {
  await tx.twoFactorSessionProof.deleteMany({ where: { appUserId } });
}

export async function resetTwoFactorCredential(tx: TwoFactorResetClient, appUserId: string, resetAt: Date) {
  await clearSecondFactorSessions(tx, appUserId);
  await clearTrustedDevices(tx, appUserId);
  await tx.twoFactorCredential.deleteMany({ where: { appUserId } });
  await tx.appUser.update({ where: { id: appUserId }, data: { twoFactorResetAt: resetAt } });
}
```

The production `TwoFactorResetClient` includes only these four delegates; the test fake must satisfy the same structural type.

- [ ] **Step 4: Apply the fail-closed lifecycle order**

For own password change:

```ts
const current = await requireCurrentAppUser();
await prisma.$transaction((tx) => clearTrustedDevices(tx, current.id));
const result = await auth.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
```

If password validation or the external call fails, losing remembered-device convenience is acceptable; do not restore a deleted token.

For admin password reset and social-to-password migration, clear trusted devices and second-factor proofs before calling Neon Auth. For deactivation, set `active: false` and clear both collections in the same Prisma transaction before `banAuthIdentity()` and `revokeAuthSessions()`. Reactivation only unbans and sets `active: true`.

- [ ] **Step 5: Run focused and existing staff tests, then commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/auth/two-factor/__tests__/reset.test.ts src/app/auth/__tests__/two-factor-lifecycle.test.ts src/lib/staff/__tests__/validate.test.ts src/lib/__tests__/roles.test.ts
pnpm exec eslint src/lib/auth/two-factor/reset.ts src/app/account/actions.ts src/app/staff/actions.ts
```

Expected: invalidation and existing staff/role tests pass.

Commit:

```bash
git add src/lib/auth/two-factor/reset.ts src/lib/auth/two-factor/__tests__/reset.test.ts src/app/auth/__tests__/two-factor-lifecycle.test.ts
git add -p src/app/account/actions.ts src/app/staff/actions.ts
git diff --cached --check
git commit -m "feat: invalidate trusted access on account changes"
```

---

### Task 9: Administrator status and exact-target reset

**Files:**
- Modify: `src/lib/staff/queries.ts`
- Modify: `src/lib/staff/validate.ts`
- Modify: `src/app/staff/actions.ts`
- Modify: `src/app/staff/staff-dialogs.tsx`
- Modify: `src/app/crm/page.tsx`
- Create: `src/lib/staff/__tests__/two-factor-reset.test.ts`
- Create: `src/app/staff/__tests__/two-factor-admin-ui.test.ts`

**Interfaces:**
- Produces: `StaffRow.twoFactorStatus: "ACTIVE" | "PENDING" | "NOT_CONFIGURED"`
- Produces: `resetStaffTwoFactorAction(previous, formData): Promise<StaffActionState>`
- Produces: `ResetTwoFactorDialog({ userId, username })`
- Consumes: `resetTwoFactorCredential()` and `revokeAuthSessions()`

- [ ] **Step 1: Write failing authorization and UI tests**

Test a pure parser for exact confirmation:

```ts
import assert from "node:assert/strict";
import { parseTwoFactorResetConfirmation } from "@/lib/staff/validate";

const form = new FormData();
form.set("userId", "target_1");
form.set("username", "ion");
form.set("confirmation", "ion");
assert.deepEqual(parseTwoFactorResetConfirmation(form), { userId: "target_1", username: "ion" });
form.set("confirmation", "ION");
assert.throws(() => parseTwoFactorResetConfirmation(form), /exact/);
```

Source tests must assert that the action calls `requireStaffAdmin()`, rejects `target.id === admin.id`, uses `logAuditRequired()` in the local reset transaction, and calls `revokeAuthSessions(target.authUserId)` afterward. UI tests assert the three Romanian status labels and hide reset for `currentUserId`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/staff/__tests__/two-factor-reset.test.ts src/app/staff/__tests__/two-factor-admin-ui.test.ts
```

Expected: FAIL because parser, status projection, action, and dialog are absent.

- [ ] **Step 3: Project status in the staff query**

Change `getStaffData()` to include only credential status:

```ts
const users = await prisma.appUser.findMany({
  include: { twoFactorCredential: { select: { status: true } } },
});

return {
  users: users.map(({ twoFactorCredential, ...user }) => {
    const twoFactorStatus: "ACTIVE" | "PENDING" | "NOT_CONFIGURED" =
      twoFactorCredential?.status ?? "NOT_CONFIGURED";
    return { ...user, twoFactorStatus };
  }),
};
```

Preserve active-first, role, and display-name sorting.

- [ ] **Step 4: Implement the fail-closed reset action**

The server action must perform:

```ts
const admin = await requireStaffAdmin();
const input = parseTwoFactorResetConfirmation(formData);
const target = await prisma.appUser.findUnique({ where: { id: input.userId } });
if (!target) throw new Error("Utilizatorul nu există.");
if (target.id === admin.id) throw new Error("Nu îți poți reseta propriul 2FA din interfață.");
if (target.username !== input.username) throw new Error("Confirmarea nu corespunde utilizatorului.");

await prisma.$transaction(async (tx) => {
  await resetTwoFactorCredential(tx, target.id, new Date());
  await logAuditRequired(tx, admin, {
    action: "UPDATE",
    entity: "AppUser",
    entityId: target.id,
    summary: `2FA resetat pentru ${target.username ?? target.id}`,
    details: { username: target.username, twoFactorReset: true },
  });
});
await revokeAuthSessions(target.authUserId);
```

If Neon revocation fails, return the approved partial-failure message while leaving the local reset and audit intact. Revalidate `/crm` in both full-success and local-success/external-failure outcomes.

- [ ] **Step 5: Add status and reset controls**

Add a separate „2FA” table column with badges „Activ”, „În configurare”, and „Neconfigurat”. Render `ResetTwoFactorDialog` only when `user.id !== currentUserId` and status is not `NOT_CONFIGURED`. The dialog requires typing the exact username and explains that all sessions and remembered devices will be invalidated.

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/staff/__tests__/two-factor-reset.test.ts src/app/staff/__tests__/two-factor-admin-ui.test.ts src/lib/staff/__tests__/validate.test.ts
pnpm exec eslint src/lib/staff/queries.ts src/app/staff/actions.ts src/app/staff/staff-dialogs.tsx src/app/crm/page.tsx
```

Expected: parser, authorization invariants, status, and UI tests pass.

Commit:

```bash
git add src/lib/staff/__tests__/two-factor-reset.test.ts src/app/staff/__tests__/two-factor-admin-ui.test.ts
git add -p src/lib/staff/queries.ts src/lib/staff/validate.ts src/app/staff/actions.ts src/app/staff/staff-dialogs.tsx src/app/crm/page.tsx
git diff --cached --check
git commit -m "feat: let administrators reset staff TOTP"
```

---

### Task 10: Interactive break-glass recovery

**Files:**
- Modify: `package.json`
- Create: `src/lib/staff/break-glass.ts`
- Create: `scripts/reset-staff-2fa.ts`
- Test: `src/lib/staff/__tests__/break-glass.test.ts`

**Interfaces:**
- Produces: `parseBreakGlassArgs(argv): { username: string; reason: string } | { help: true }`
- Produces: `expectedBreakGlassConfirmation(username): string`
- Consumes: `resetTwoFactorCredential()`, `logAuditRequired()` semantics, and `revokeAuthSessions()`
- Produces: `pnpm staff:reset-2fa --username <exact> --reason <non-empty>`

- [ ] **Step 1: Write failing CLI parser tests**

```ts
import assert from "node:assert/strict";
import { expectedBreakGlassConfirmation, parseBreakGlassArgs } from "@/lib/staff/break-glass";

assert.deepEqual(parseBreakGlassArgs(["--username", "ion", "--reason", "telefon pierdut"]), { username: "ion", reason: "telefon pierdut" });
assert.deepEqual(parseBreakGlassArgs(["--help"]), { help: true });
assert.throws(() => parseBreakGlassArgs(["--username", "ion"]), /reason/);
assert.throws(() => parseBreakGlassArgs(["--username", "ion", "--reason", "x", "--force"]), /--force/);
assert.equal(expectedBreakGlassConfirmation("ion"), "RESET ion");
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --env-file=.env --test src/lib/staff/__tests__/break-glass.test.ts`

Expected: FAIL because parser and command are absent.

- [ ] **Step 3: Implement strict parsing and interactive confirmation**

`parseBreakGlassArgs()` accepts only `--username`, `--reason`, and `--help`; normalizes username with `normalizeUsername`, rejects empty reason, duplicate flags, unknown flags, `--force`, and positional arguments.

In the executable script:

```ts
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  throw new Error("Comanda break-glass necesită un terminal interactiv.");
}

const target = await prisma.appUser.findUnique({ where: { username: input.username } });
if (!target) throw new Error("Utilizatorul nu există.");
console.log({ id: target.id, username: target.username, name: target.name, role: target.role, active: target.active });
const answer = await question(`Tastează ${expectedBreakGlassConfirmation(input.username)}: `);
if (answer !== expectedBreakGlassConfirmation(input.username)) throw new Error("Confirmare anulată.");
```

Do not query `encryptedSecret` and do not print environment values, cookies, session IDs, tokens, or database URLs.

- [ ] **Step 4: Execute local reset, audit, and external revocation**

In one Prisma transaction call `resetTwoFactorCredential()`, then create an `AuditLog` with `userName: "BREAK_GLASS"`, `action: "UPDATE"`, `entity: "AppUser"`, the target ID, reason, and `{ username, twoFactorReset: true, breakGlass: true }`. After commit, call `revokeAuthSessions(target.authUserId)`.

Set `process.exitCode = 1` for any error, including external revocation after a successful local reset. The local reset is not rolled back because it is the fail-closed security boundary. Always disconnect Prisma in `finally`.

Add:

```json
"staff:reset-2fa": "tsx --env-file=.env scripts/reset-staff-2fa.ts"
```

- [ ] **Step 5: Run safe command tests and commit**

Run:

```bash
pnpm exec tsx --env-file=.env --test src/lib/staff/__tests__/break-glass.test.ts
pnpm staff:reset-2fa --help
pnpm exec eslint src/lib/staff/break-glass.ts scripts/reset-staff-2fa.ts
```

Expected: parser tests pass; `--help` prints usage and performs no database mutation; ESLint exits 0.

Commit:

```bash
git add src/lib/staff/break-glass.ts src/lib/staff/__tests__/break-glass.test.ts scripts/reset-staff-2fa.ts
git add -p package.json
git diff --cached --check
git commit -m "feat: add audited break-glass TOTP reset"
```

---

### Task 11: Device removal, rollout runbook, and full verification

**Files:**
- Modify: `src/app/auth/actions.ts`
- Create: `src/app/account/trusted-device-control.tsx`
- Modify: `src/app/crm/page.tsx`
- Create: `src/app/auth/__tests__/trusted-device-control.test.ts`
- Create: `docs/runbooks/two-factor-authentication.md`
- Verify: all files changed in Tasks 1-10

**Interfaces:**
- Produces: `forgetCurrentTrustedDeviceAction(): Promise<void>`
- Produces: visible „Uită acest dispozitiv” control for a fully authenticated user
- Produces: production rollout and recovery runbook with exact commands

- [ ] **Step 1: Write the failing remembered-device removal test**

Create a source-invariant test matching the repository's existing auth tests:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actions = readFileSync("src/app/auth/actions.ts", "utf8");
const control = readFileSync("src/app/account/trusted-device-control.tsx", "utf8");
const start = actions.indexOf("export async function forgetCurrentTrustedDeviceAction");
const nextExport = actions.indexOf("\nexport ", start + 1);
const forgetAction = actions.slice(start, nextExport === -1 ? undefined : nextExport);

assert.notEqual(start, -1);
assert.match(forgetAction, /state\.kind !== ["']AUTHENTICATED["']/);
assert.match(forgetAction, /trustedDevice\.deleteMany/);
assert.match(forgetAction, /appUserId:[\s\S]*tokenHash:/);
assert.match(forgetAction, /trustedCookieName/);
assert.doesNotMatch(forgetAction, /twoFactorSessionProof\.deleteMany/);
assert.doesNotMatch(forgetAction, /auth\.signOut/);
assert.match(control, /Uită acest dispozitiv/);
assert.match(control, /window\.confirm/);
```

Keep the action small enough that these negative assertions cover only its function body. The test proves that removal reads only the trusted-device cookie, deletes the matching hash for the current `AppUser`, clears that cookie, and leaves the current proof and Neon session untouched.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --env-file=.env --test src/app/auth/__tests__/trusted-device-control.test.ts`

Expected: FAIL because the action and control do not exist.

- [ ] **Step 3: Implement explicit remembered-device removal**

The action must require `AUTHENTICATED`, hash the current trusted cookie, delete only `{ appUserId: current.id, tokenHash }`, and clear the browser cookie. The React control submits after:

```ts
window.confirm("Uiți acest dispozitiv? La următoarea autentificare va fi cerut codul din Authenticator.")
```

Do not sign out and do not delete `TwoFactorSessionProof`.

- [ ] **Step 4: Write the rollout and recovery runbook**

The runbook must include these exact preparation commands:

```bash
openssl rand -base64 32
openssl rand -base64 32
pnpm exec prisma validate
pnpm prisma:generate
pnpm db:push
pnpm staff:reset-2fa --help
```

State that the two generated values are stored separately as `TWO_FACTOR_ENCRYPTION_KEY` and `TWO_FACTOR_RATE_LIMIT_PEPPER`, never committed. Require a Neon branch/backup before `db:push`, at least one active admin with username, default HTTPS, and a tested interactive break-glass shell. Document normal admin reset, sole-admin break-glass reset, partial revocation failure, encryption-key loss, and rollback: code rollback alone does not remove the additive tables, while re-enabling old code removes the gate and therefore requires an explicit security decision.

- [ ] **Step 5: Run all automated verification**

Run:

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec prisma validate
git diff --check -- src/app/auth/actions.ts src/app/account/trusted-device-control.tsx src/app/crm/page.tsx src/app/auth/__tests__/trusted-device-control.test.ts docs/runbooks/two-factor-authentication.md
```

Expected: all tests pass, lint exits 0, production build succeeds, Prisma validates, and the Task 11 diff check is empty. Earlier task commits already run scoped or staged diff checks. If an unrelated pre-existing failure appears, record its exact command and output, then prove all 2FA-focused commands remain green before changing unrelated code.

- [ ] **Step 6: Verify authenticated behavior in a development Neon branch**

Run `pnpm dev`, then verify in the browser in this order:

1. an existing password user is sent to setup before any CRM data appears;
2. QR and manual key represent issuer `Nadin Auto` and the correct username;
3. one current six-digit code activates the credential and opens CRM;
4. replaying that code in another fresh primary session is rejected;
5. password login without remembering requires TOTP again;
6. password login with remembering bypasses only TOTP for the next 30 days;
7. Google login follows the same continue/setup/verify dispatcher;
8. „Uită acest dispozitiv” makes the next login request TOTP;
9. password change removes remembered-device trust;
10. another admin reset signs the target out and forces a fresh first factor plus new enrollment;
11. the current admin has no UI self-reset button;
12. public `/catalog` and `/ru/catalog` remain accessible without authentication;
13. desktop and mobile-width setup/verify forms remain usable and show no secret in the browser URL or console.

Use a test account and delete its test credential through the normal admin reset afterward. Never run the break-glass mutation against a production account merely as a smoke test.

- [ ] **Step 7: Commit final controls and documentation**

```bash
git add src/app/account/trusted-device-control.tsx src/app/auth/__tests__/trusted-device-control.test.ts docs/runbooks/two-factor-authentication.md
git add -p src/app/auth/actions.ts src/app/crm/page.tsx
git diff --cached --check
git commit -m "docs: add TOTP rollout and recovery controls"
```

Expected: `git status --short` contains only unrelated pre-existing worktree changes.
