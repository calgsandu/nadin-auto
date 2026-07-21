# First Administrator 2FA Bootstrap Design

## Context

The activation-code enrollment gate creates a circular dependency during the
first production setup: an administrator must enter the CRM to issue a 2FA
activation code, but the first administrator cannot enter the CRM until 2FA is
configured. The interactive break-glass script can recover this state from a
trusted terminal, but it does not provide a usable initial setup flow for a
remote administrator.

This design adds one narrowly scoped bootstrap exception to the existing
activation-code model and adds explicit diagnostics to the 2FA dispatcher so a
server failure is never presented as an unexplained blank page.

## Bootstrap eligibility

An authenticated user may start TOTP enrollment without an activation code
only when all of these conditions are true at the time enrollment begins:

1. the current application user is active, has a username, and has role
   `ADMIN`;
2. the current user is the earliest-created active administrator, with `id` as
   the deterministic tie-breaker;
3. no `ACTIVE` two-factor credential exists anywhere in the application; and
4. the current user has no active credential and no still-valid pending setup
   bound to another session.

The eligibility check is server-side and is repeated inside the transaction
that creates the pending credential. UI state alone never authorizes the
bootstrap. The exception is therefore available to one deterministic account
only during the application's uninitialized 2FA state. As soon as any TOTP
credential becomes active, every future enrollment requires a normal
administrator-issued activation code or the existing interactive break-glass
procedure.

## Enrollment flow

`/auth/2fa/setup` continues to call the enrollment service. When the current
session already owns a valid pending setup, the page displays its QR code as it
does today. Otherwise:

- an eligible bootstrap administrator sees an explanation and an
  `Inițializează 2FA` server-action button;
- every other user sees the activation-code form;
- an active credential remains a hard rejection.

The server action revalidates eligibility, creates a freshly generated pending
credential bound to the exact Neon Auth session, and redirects back to the setup
page, which can then reveal the QR. This keeps GET rendering free of mutations.
Bootstrap creation uses the same encrypted secret, 15-minute setup expiry,
session binding, rate-limit protections, and TOTP confirmation path as normal
activation-code enrollment. It does not create or consume an enrollment grant.
If setup expires before confirmation, the same eligible administrator may
restart bootstrap only while the system still has no active 2FA credential.

The bootstrap transaction writes a required audit entry with event
`TWO_FACTOR_BOOTSTRAP_STARTED`. No secret, session identifier, cookie, or hash
is included in the audit. An audit failure rolls back credential creation.

## Concurrency and failure behavior

Bootstrap authorization and pending-credential replacement execute in a
serializable transaction. If a concurrent request changes administrator order
or activates a credential, the transaction is retried or rejected and the user
returns to the activation-required state. The database's unique credential per
user constraint prevents duplicate pending credentials for repeated requests.

The `/auth/2fa/continue` dispatcher must retain server redirects for successful
states. Its work is wrapped in explicit failure handling that logs a sanitized
high-level error and redirects to a dedicated 2FA error page. The error page
explains that authentication could not be completed and provides actions to
retry the dispatcher or sign in again. It never exposes internal exceptions or
authentication state.

## Security boundaries

- Being an administrator is insufficient by itself; the user must also be the
  deterministic first active administrator and the whole system must have zero
  active 2FA credentials.
- Deleting or resetting the last active credential does not reopen browser
  bootstrap after the system has already been initialized. A persistent
  bootstrap-completed marker records first successful activation.
- The marker is written atomically with the first successful TOTP activation.
  It is never cleared by normal reset, staff deletion, or break-glass recovery.
- Existing administrator issue/reset prohibitions, activation-code rules, and
  the break-glass command remain unchanged.

The persistent marker is stored in a single-row `ApplicationSecurityState`
model with fixed ID `global` and nullable `twoFactorBootstrapCompletedAt`.
Eligibility treats a missing row as not completed only when there are also zero
active credentials. The first successful activation upserts the row and sets
the timestamp in the same transaction as credential activation. Deployments
must run a small idempotent backfill that sets the marker when an active
credential already exists; this preserves the completed state for installations
that adopted 2FA before this model was added.

## Verification

Automated tests must prove that:

- only the earliest active administrator is eligible before initialization;
- employees, directors, later administrators, inactive users, and users without
  usernames cannot bootstrap;
- any active credential or completed marker disables bootstrap;
- an eligible bootstrap creates one encrypted, session-bound, expiring pending
  credential and writes the required audit entry atomically;
- rendering the setup page alone does not create or rotate a credential;
- repeated requests reuse or safely replace only that administrator's pending
  setup without creating duplicates;
- first successful activation permanently marks bootstrap completed;
- resets and deletion cannot reopen bootstrap;
- dispatcher exceptions lead to the dedicated error page, while all four normal
  access states retain their existing redirects;
- existing activation-code, TOTP, trusted-device, route, type, lint, Prisma,
  and build checks remain green.

Manual verification must cover Google login from a phone-sized browser, initial
QR enrollment, TOTP confirmation, a new session requiring TOTP, and a later
user still requiring an administrator-issued activation code.
