# Secure 2FA Enrollment Bootstrap Design

## Context

Nadin Auto already requires TOTP after Neon Auth, but an account without an
active TOTP credential currently receives a QR code immediately after the
first factor. An attacker who obtains a password or a Google session before
the legitimate user enrolls can therefore bind the attacker's Authenticator.
The same race exists immediately after an administrator resets 2FA.

This design adds a trusted bootstrap step. Every new TOTP enrollment requires
a short-lived, single-use activation code issued by a different administrator
or by the interactive break-glass command. Password or Google authentication
alone must never create or reveal a TOTP secret.

## Security goals

- No QR code, manual TOTP secret, or pending credential is created before a
  valid activation code is consumed.
- Activation codes are random, user-specific, valid for 15 minutes, and
  single-use.
- The database stores only a domain-separated hash of each activation code.
- A consumed activation code authorizes only the exact Neon Auth session that
  consumed it and only until the pending TOTP setup expires.
- Issuing a replacement code invalidates every older code and pending QR for
  that user.
- Existing active TOTP credentials remain valid during rollout.
- Every issuance, consumption, reset, and activation is audited without
  recording codes, hashes, TOTP secrets, cookies, or session identifiers.
- Normal administrators cannot issue or reset 2FA for themselves. A sole
  administrator uses the interactive break-glass command.

The separate delivery channel remains an operational requirement. Displaying
the activation code in CRM is secure only when the administrator communicates
it to the intended user independently, preferably in person. Email and SMS
delivery are outside this scope.

## Activation code

The code contains 16 Crockford Base32 characters grouped as
`XXXX-XXXX-XXXX-XXXX`. Ten random bytes provide 80 bits of entropy. Ambiguous
characters are excluded. Input is normalized by removing spaces and hyphens
and converting to uppercase.

The stored value is
`SHA-256("nadin-auto:2fa-enrollment-grant:" || normalizedCode)`. The plaintext
is returned only by the issuance call and is never persisted or logged. A
code expires exactly 15 minutes after issuance.

Existing 2FA user-session and IP rate limits also protect activation attempts:
five failed attempts lock the current user session for 15 minutes, and 25
failed attempts lock the trusted IP scope for 15 minutes. Error messages do
not distinguish a wrong, consumed, superseded, or expired code.

## Data model

Add one nullable relation to `AppUser` and one new model:

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

Add `enrollmentAuthSessionHash String?` to `TwoFactorCredential`. It is
required by application invariants while the credential is `PENDING` and is
cleared when the credential becomes `ACTIVE`. A nullable column keeps the
database change additive; any legacy pending credential with a null binding is
treated as unauthorized and can never expose its secret.

Issuer identity and operational reason belong in `AuditLog`, not in the grant
row. At most one usable grant exists per user.

## Administrator flows

### Issue for a user who is not configured

The Personal table displays an `Emite cod 2FA` action for another user whose
credential is not active. The administrator confirms the target. In one
transaction the application:

1. verifies again that the target is active, has a username, is not the actor,
   and has no active TOTP credential;
2. deletes any previous grant and any pending credential for the target;
3. creates a new hashed grant with a 15-minute expiry;
4. writes a required audit entry.

The UI displays the plaintext code once, together with its expiry and the
instruction to communicate it through a separate channel. Closing the drawer
loses the plaintext; generating another code invalidates the previous one.

### Reset an active credential

The existing exact-username confirmation remains. In one transaction the
application clears proofs, trusted devices, the active credential, and any old
grant, updates `twoFactorResetAt`, creates a fresh grant, and writes the
required reset-and-issue audit entry. It then revokes Neon Auth sessions.

The new activation code is displayed once even if external Neon revocation
fails. In that partial-failure case local access remains blocked, the UI shows
an explicit warning, and the administrator must retry external revocation or
temporarily ban the identity. The code itself is never included in the audit
or error logs.

### Staff creation and account changes

Creating a user does not automatically issue an activation code. The
administrator uses the explicit action after confirming the employee is ready
to receive it. Password changes, administrator password resets, and account
deactivation delete any outstanding activation grant. Reactivation never
recreates a grant automatically.

## User enrollment flow

The existing access-state kind `ENROLLMENT_REQUIRED` remains sufficient.
`/auth/2fa/setup` selects one of two server-rendered states:

- Without an authorized pending credential bound to the current Neon session,
  it renders only an activation-code form. It must not query or render the
  encrypted TOTP secret.
- With an unexpired pending credential bound to the current Neon session, it
  decrypts the secret server-side and renders the QR code, manual key, TOTP
  confirmation form, and remaining expiry.

Submitting an activation code performs the following transaction:

1. revalidates the active `AppUser`, username, primary session, and reset
   timestamp;
2. atomically consumes the matching unexpired grant;
3. deletes any unauthorized or superseded pending credential;
4. creates a fresh encrypted pending TOTP credential bound to
   `hashNeonSessionId(primary.sessionId)` with the same 15-minute setup window;
5. writes a required audit entry that enrollment was authorized.

If any step fails, the transaction rolls back and the grant remains usable
unless it was invalid. A wrong code records a rate-limit failure. Success
clears the current user-session failure counter and redirects back to the setup
page, which can now reveal the QR.

Regenerating the QR is allowed only from the bound Neon session while the
pending setup is still unexpired. Regeneration replaces the TOTP secret but
does not extend the original expiry. An expired setup or a different Neon
session requires a newly issued administrator code.

TOTP confirmation must match the credential ID, user ID, `PENDING` status,
future expiry, and bound session hash. Activation clears the binding, sets
`ACTIVE`, records the accepted TOTP step, and writes the required activation
audit in the same transaction. Session proof and optional 30-day trusted
device issuance continue afterward as in the existing design.

## Break-glass flow

`pnpm staff:reset-2fa --username <exact> --reason <non-empty>` remains
interactive and has no force or HTTP equivalent. After exact `RESET <username>`
confirmation, its local transaction:

1. performs the existing fail-closed reset;
2. invalidates any previous grant;
3. issues a fresh hashed activation grant;
4. writes the `BREAK_GLASS` audit with the reason and no secret material.

The command prints the activation code once after the local commit, then
revokes Neon sessions. If revocation fails, it exits non-zero but still prints
the code and states that local reset succeeded. This same command bootstraps a
sole administrator who has no TOTP credential yet.

## Failure handling and invariants

- An audit failure rolls back grant issuance, consumption, reset, or TOTP
  activation.
- An invalid or expired grant never deletes an existing pending credential.
- A valid replacement grant intentionally invalidates the previous pending QR.
- A primary session created at or before `twoFactorResetAt` cannot consume a
  grant.
- A pending credential with a missing or mismatched session binding never
  reveals its secret and never activates.
- No action accepts a user ID or username without reloading and validating the
  target from the database.
- Source logs may contain high-level operation failures but never codes,
  hashes, TOTP secrets, cookies, session IDs, or database URLs.

## Rollout

The schema change is additive. Apply it first to a Neon branch or verified
backup. Existing `ACTIVE` credentials continue working. Before enabling the
new code, delete any legacy `PENDING` credentials or rely on the null-binding
invariant, which makes them unusable and invisible. No activation grants are
created automatically during deployment.

The production environment must retain the existing
`TWO_FACTOR_ENCRYPTION_KEY` and `TWO_FACTOR_RATE_LIMIT_PEPPER`; rotating or
losing the encryption key still invalidates the ability to read existing TOTP
secrets.

## Verification

Automated tests must prove:

- activation code format, entropy source, normalization, hashing, and exact
  expiry;
- issuance replaces prior grants and pending credentials atomically;
- invalid, expired, consumed, or wrong-user codes cannot start enrollment;
- successful consumption is single-use and binds the pending credential to the
  current Neon session;
- QR and manual secret are absent before authorization and unavailable from a
  second session;
- regeneration does not extend authorization;
- TOTP activation requires the matching session binding and audits atomically;
- normal issue/reset actions are administrator-only and forbid self-service;
- reset and break-glass reveal one fresh code without logging it;
- password changes and deactivation invalidate outstanding grants;
- all existing TOTP, trusted-device, route-enforcement, lint, TypeScript,
  Prisma validation, and production build checks remain green.

Manual verification on a development Neon branch must cover password and
Google first factors, first enrollment, wrong and expired activation codes,
replacement-code invalidation, second-session denial, administrator reset,
sole-admin break-glass recovery, and public catalog access.
