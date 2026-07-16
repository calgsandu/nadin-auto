# Catalog hero and CRM route design

## Goal

Make the public catalog hero slightly more contrasted without turning it into a dark hero, and reduce the public discoverability of the internal CRM.

## Public catalog hero

- Keep the existing hero image, copy, layout, and calls to action.
- Replace the washed-out treatment with a restrained, cool dark overlay that improves text separation while preserving the image detail and light catalog character.
- Keep the bottom transition into the catalog background so the following section remains visually continuous.

## CRM route and public boundary

- The internal workspace will live at `/crm`.
- Existing workspace query-string navigation will remain intact under `/crm` (for example `/crm?section=produse`).
- The former root route `/` will redirect authenticated internal users to `/crm` and all other visitors to `/catalog`.
- `/crm` remains behind the existing authentication middleware and the existing active-user and role checks. Changing the URL is a discoverability measure, not an authorization mechanism.
- The public catalog footer will not advertise an employee/CRM login link.

## Search-engine controls

- CRM pages will emit `noindex, nofollow` metadata.
- A `robots.txt` route will disallow crawling of `/crm` and authentication pages while allowing the catalog.
- No CRM or authentication route will be included in a sitemap.

## Verification

- Confirm `/catalog` still renders publicly and its hero is subtly darker/clearer.
- Confirm an unauthenticated request to `/crm` is sent to sign-in.
- Confirm an authenticated active user can use `/crm` and a restricted role cannot open a forbidden section.
- Confirm `/` redirects according to authentication state.
- Run lint and relevant automated tests after the change.
