# Russian Public Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully localized Russian public catalog at `/ru/catalog`, with saved Russian product data, bilingual search, SEO alternates, and editable translations in CRM.

**Architecture:** Keep `/catalog` as Romanian and add thin `/ru/catalog` route wrappers around shared page views. A typed `vitrina/i18n` module owns locale copy, URL generation, and translated-value fallback; Prisma stores optional Russian fields and public queries choose the requested locale. A repeatable backfill script fills only empty Russian fields and reports unresolved source values.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript, Prisma 7/PostgreSQL, Node test runner via `tsx --test`.

## Global Constraints

- The internal CRM remains Romanian.
- Romanian keeps the existing `/catalog` URLs unchanged.
- Russian public routes use the exact `/ru/catalog` prefix.
- Brand, model, product IDs, and existing slugs do not change.
- Missing Russian content falls back to the original value and never hides a product.
- Imports and backfill must never overwrite a non-empty manually saved Russian translation.
- Search on Russian routes must match Russian text, original text, codes, brands, and models.
- Use `ro-MD` number formatting for Romanian and `ru-MD` for Russian.
- No new runtime translation API or paid dependency is introduced.

---

### Task 1: Persist and edit Russian catalog fields

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/admin/validate.ts`
- Modify: `src/lib/admin/__tests__/validate.test.ts`
- Modify: `src/app/admin/actions.ts`
- Modify: `src/app/admin/admin-dialogs.tsx`
- Modify: `src/app/catalog/actions.ts`
- Modify: `src/app/catalog/product-form-dialog.tsx`
- Modify: `src/app/crm/page.tsx`
- Regenerate: `src/generated/prisma/**`

**Interfaces:**
- Produces: optional `descriptionRu`, `notesRu`, `nameRu`, and `labelRu` Prisma fields.
- Produces: `optionalText(formData, key): string | null` parsing behavior used by admin and product actions.
- Consumes: existing role checks, audit transactions, and CRM dialogs.

- [ ] **Step 1: Write failing validation tests**

Extend `src/lib/admin/__tests__/validate.test.ts` with real `FormData` cases proving whitespace-only Russian values become `null` and trimmed text survives:

```ts
const translatedName = new FormData();
translatedName.set("name", "Prag");
translatedName.set("nameRu", "  Порог  ");
assert.deepEqual(parseTranslatedName(translatedName), {
  ok: true,
  data: { name: "Prag", nameRu: "Порог" },
});

const translatedFitment = new FormData();
translatedFitment.set("carModelId", "model-1");
translatedFitment.set("label", "toți anii");
translatedFitment.set("labelRu", "   ");
assert.equal(parseFitment(translatedFitment).ok, true);
if (parseFitment(translatedFitment).ok) {
  assert.equal(parseFitment(translatedFitment).data.labelRu, null);
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test src/lib/admin/__tests__/validate.test.ts`

Expected: FAIL because `parseTranslatedName` does not exist and `parseFitment` has no `labelRu`.

- [ ] **Step 3: Add optional columns and parsers**

Add these exact optional columns:

```prisma
model VehicleFitment {
  // existing fields
  labelRu String?
}

model ProductType {
  // existing fields
  nameRu String?
}

model Product {
  // existing fields
  descriptionRu String?
  notesRu       String?
}
```

In `src/lib/admin/validate.ts`, add:

```ts
export function optionalText(formData: FormData, key: string): string | null {
  return str(formData, key) || null;
}

export function parseTranslatedName(
  formData: FormData,
): Parsed<{ name: string; nameRu: string | null }> {
  const parsed = parseName(formData);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    data: { ...parsed.data, nameRu: optionalText(formData, "nameRu") },
  };
}
```

Return `labelRu: optionalText(formData, "labelRu")` from `parseFitment`.

- [ ] **Step 4: Save translations through existing actions**

Use `parseTranslatedName` for product types, keep `parseName` for brands, and include `labelRu` from `parseFitment`. In `parseProductForm`, read and return:

```ts
const descriptionRu = readString(formData, "descriptionRu") || null;
const notes = readString(formData, "notes") || null;
const notesRu = readString(formData, "notesRu") || null;
```

Write those fields in both `createProductAction` and `updateProductAction`, and include them in `productAuditSnapshot`. Do not touch these columns in import scripts, which preserves manual values by construction.

- [ ] **Step 5: Add CRM fields**

Add `nameRu` to the type dialog/entity and `labelRu` to the fitment dialog/entity. Add three product fields after the Romanian description: `descriptionRu`, `notes`, and `notesRu`. Extend `ProductFormValue` and `toProductFormValue` with the same properties.

Use these Romanian labels:

```tsx
<Field label="Descriere în rusă">
  <textarea name="descriptionRu" defaultValue={product?.descriptionRu ?? ""} />
</Field>
<Field label="Notițe interne/publice">
  <textarea name="notes" defaultValue={product?.notes ?? ""} />
</Field>
<Field label="Notițe în rusă">
  <textarea name="notesRu" defaultValue={product?.notesRu ?? ""} />
</Field>
```

- [ ] **Step 6: Regenerate Prisma and verify GREEN**

Run:

```bash
pnpm prisma:generate
pnpm test src/lib/admin/__tests__/validate.test.ts
pnpm exec tsc --noEmit
```

Expected: Prisma generation succeeds; the focused test and TypeScript pass.

- [ ] **Step 7: Commit the persistence slice**

```bash
git add prisma/schema.prisma src/generated/prisma src/lib/admin/validate.ts src/lib/admin/__tests__/validate.test.ts src/app/admin/actions.ts src/app/admin/admin-dialogs.tsx src/app/catalog/actions.ts src/app/catalog/product-form-dialog.tsx src/app/crm/page.tsx
git commit -m "feat: store russian catalog translations"
```

---

### Task 2: Add typed locale, copy, paths, and fallback helpers

**Files:**
- Create: `src/lib/vitrina/i18n.ts`
- Create: `src/lib/vitrina/__tests__/i18n.test.ts`

**Interfaces:**
- Produces: `CatalogLocale = "ro" | "ru"`.
- Produces: `catalogCopy(locale)`, `catalogHref(locale, path)`, `alternateCatalogHref(path)`, `localizedValue(locale, original, russian)`, and `catalogNumberFormat(locale)`.
- Consumes: no database or React state.

- [ ] **Step 1: Write failing path and fallback tests**

Create `src/lib/vitrina/__tests__/i18n.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  catalogHref,
  localizedValue,
  localeFromCatalogPath,
} from "@/lib/vitrina/i18n";

assert.equal(catalogHref("ro"), "/catalog");
assert.equal(catalogHref("ru"), "/ru/catalog");
assert.equal(catalogHref("ru", "/cauta?q=prag"), "/ru/catalog/cauta?q=prag");
assert.equal(catalogHref("ro", "/ford/focus"), "/catalog/ford/focus");
assert.equal(localeFromCatalogPath("/ru/catalog/ford"), "ru");
assert.equal(localeFromCatalogPath("/catalog/ford"), "ro");
assert.equal(localizedValue("ru", "Prag", " Порог "), "Порог");
assert.equal(localizedValue("ru", "Prag", "  "), "Prag");
assert.equal(localizedValue("ro", "Prag", "Порог"), "Prag");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test src/lib/vitrina/__tests__/i18n.test.ts`

Expected: FAIL with module-not-found for `@/lib/vitrina/i18n`.

- [ ] **Step 3: Implement the locale helpers**

Create `src/lib/vitrina/i18n.ts` with a typed dictionary covering every static string found by `rg -n '>[[:space:]]*[[:alpha:]][^<{]*<' 'src/app/(vitrina)/catalog'`. The public API starts with:

```ts
export type CatalogLocale = "ro" | "ru";

export function catalogHref(locale: CatalogLocale, suffix = "") {
  const base = locale === "ru" ? "/ru/catalog" : "/catalog";
  if (!suffix) return base;
  return `${base}${suffix.startsWith("/") || suffix.startsWith("?") || suffix.startsWith("#") ? "" : "/"}${suffix}`;
}

export function localeFromCatalogPath(pathname: string): CatalogLocale {
  return pathname === "/ru/catalog" || pathname.startsWith("/ru/catalog/") ? "ru" : "ro";
}

export function localizedValue(
  locale: CatalogLocale,
  original: string,
  russian: string | null | undefined,
) {
  const translated = russian?.trim();
  return locale === "ru" && translated ? translated : original;
}

export function catalogNumberFormat(locale: CatalogLocale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-MD" : "ro-MD");
}
```

The Russian dictionary must use natural UI copy, including `Марки`, `Категории`, `Найти деталь`, `В наличии`, `Нет в наличии`, `Местное производство`, `Все`, `Все годы`, `с`, `по настоящее время`, and translated empty/error states.

- [ ] **Step 4: Verify GREEN and scan for untranslated UI literals**

Run:

```bash
pnpm test src/lib/vitrina/__tests__/i18n.test.ts
pnpm exec tsc --noEmit
```

Expected: PASS. Keep the literal scan output for Task 4; only proper nouns and data values may remain after route conversion.

- [ ] **Step 5: Commit the localization core**

```bash
git add src/lib/vitrina/i18n.ts src/lib/vitrina/__tests__/i18n.test.ts
git commit -m "feat: add catalog locale helpers"
```

---

### Task 3: Localize catalog queries and bilingual search

**Files:**
- Modify: `src/lib/vitrina/queries.ts`
- Create: `src/lib/vitrina/__tests__/localized-data.test.ts`
- Modify: `src/lib/catalog/__tests__/queries.test.ts`

**Interfaces:**
- Consumes: `CatalogLocale`, `localizedValue` from Task 2 and Prisma columns from Task 1.
- Produces: locale-aware `getShowroomData(locale)`, `getBrandData(brandSlug, locale)`, `getModelData(brandSlug, modelSlug, locale)`, `getProductDetails(id, locale)`, and `searchPublicProducts(query, locale)`.

- [ ] **Step 1: Write failing pure projection tests**

Export a pure helper named `localizePublicProduct` and test it in `localized-data.test.ts`:

```ts
import assert from "node:assert/strict";
import { localizePublicProduct } from "@/lib/vitrina/queries";

const row = {
  id: "p1",
  externalCode: "A1",
  description: "Prag stânga",
  descriptionRu: "Левый порог",
  stock: 2,
  isLocal: false,
  fitment: { label: "toți anii", labelRu: "все годы" },
};

assert.equal(localizePublicProduct(row, "ru").description, "Левый порог");
assert.equal(localizePublicProduct({ ...row, descriptionRu: null }, "ru").description, "Prag stânga");
assert.equal(localizePublicProduct(row, "ro").fitLabel, "toți anii");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test src/lib/vitrina/__tests__/localized-data.test.ts`

Expected: FAIL because `localizePublicProduct` does not exist.

- [ ] **Step 3: Add locale parameters and projections**

Select Russian fields in every public Prisma query. Use the original type name for the stable group/filter slug, but expose the localized display name:

```ts
const originalType = product.type.name;
const displayType = localizedValue(locale, originalType, product.type.nameRu);
const key = originalType;
groups.set(key, {
  type: displayType,
  slug: slugify(originalType),
  products: [],
});
```

Localize product description, notes, type, and fitment label. Keep brand/model names and slugs unchanged. Generate year text through a locale-aware helper so Russian uses `по настоящее время` and `с {year}`.

- [ ] **Step 4: Make search bilingual**

For every search term, add `descriptionRu`, `type.name`, `type.nameRu`, `fitment.label`, and `fitment.labelRu` alongside the current code/brand/model conditions. Return localized fields using the same projection helper. Keep `take: 80` and the original ordering as deterministic fallback.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
pnpm test src/lib/vitrina/__tests__/localized-data.test.ts src/lib/catalog/__tests__/queries.test.ts
pnpm exec tsc --noEmit
```

Expected: both focused tests and TypeScript pass.

- [ ] **Step 6: Commit localized data access**

```bash
git add src/lib/vitrina/queries.ts src/lib/vitrina/__tests__/localized-data.test.ts src/lib/catalog/__tests__/queries.test.ts
git commit -m "feat: localize public catalog data"
```

---

### Task 4: Share page views and add `/ru/catalog` routes

**Files:**
- Modify: `src/app/(vitrina)/catalog/layout.tsx`
- Modify: `src/app/(vitrina)/catalog/page.tsx`
- Modify: `src/app/(vitrina)/catalog/[brand]/page.tsx`
- Modify: `src/app/(vitrina)/catalog/[brand]/[model]/page.tsx`
- Modify: `src/app/(vitrina)/catalog/cauta/page.tsx`
- Modify: `src/app/(vitrina)/catalog/cauta/search-box.tsx`
- Modify: `src/app/(vitrina)/catalog/piesa/[id]/page.tsx`
- Create: `src/app/(vitrina)/ru/catalog/layout.tsx`
- Create: `src/app/(vitrina)/ru/catalog/page.tsx`
- Create: `src/app/(vitrina)/ru/catalog/[brand]/page.tsx`
- Create: `src/app/(vitrina)/ru/catalog/[brand]/[model]/page.tsx`
- Create: `src/app/(vitrina)/ru/catalog/cauta/page.tsx`
- Create: `src/app/(vitrina)/ru/catalog/piesa/[id]/page.tsx`
- Create: `src/app/(vitrina)/catalog/__tests__/localized-routes.test.ts`

**Interfaces:**
- Consumes: locale-aware queries and `catalogHref`/dictionary from Tasks 2–3.
- Produces: named shared views such as `CatalogPageView({ locale })` and thin route defaults for `ro` and `ru`.

- [ ] **Step 1: Write failing route-presence tests**

Create a source-level regression test that reads every Russian wrapper and asserts it passes `locale="ru"`, then checks the Romanian defaults pass `locale="ro"`. Also assert all public link construction in the shared views uses `catalogHref(locale, ...)` rather than hard-coded `/catalog`.

Run: `pnpm test 'src/app/(vitrina)/catalog/__tests__/localized-routes.test.ts'`

Expected: FAIL because the Russian route tree does not exist.

- [ ] **Step 2: Convert the layout to a locale-aware shared shell**

Export `CatalogLayoutView({ children, locale })` from the existing layout, replace `Outfit` with `Manrope` using `subsets: ["latin", "cyrillic"]`, translate header/footer copy, and render a `RO / RU` switch. The switch destination is computed from the current catalog pathname in a small client component so `/catalog/ford/focus?tip=prag` becomes `/ru/catalog/ford/focus?tip=prag` and vice versa.

- [ ] **Step 3: Convert every page to a shared view**

For each Romanian page, export a named view receiving `locale: CatalogLocale`; the default export calls it with `ro`. Replace static copy, number formatting, years, alt text, breadcrumbs, and every internal href with the locale helpers. Pass locale into query functions and `SearchBox`.

Use locale-specific metadata with canonical and alternates:

```ts
alternates: {
  canonical: catalogHref(locale, suffix),
  languages: {
    ro: catalogHref("ro", suffix),
    ru: catalogHref("ru", suffix),
  },
}
```

- [ ] **Step 4: Add thin Russian wrappers**

Each Russian route imports the named view from its Romanian peer and calls it with `locale="ru"`. Dynamic wrappers re-export or duplicate `generateStaticParams` with the same stable slug params; their metadata calls the same metadata builder with `ru`.

- [ ] **Step 5: Run route tests and literal audit**

Run:

```bash
pnpm test 'src/app/(vitrina)/catalog/__tests__/localized-routes.test.ts'
rg -n 'href="/catalog|href=\{`/catalog' 'src/app/(vitrina)/catalog'
pnpm exec tsc --noEmit
```

Expected: test and TypeScript PASS; the href scan returns no hard-coded catalog navigation in shared views.

- [ ] **Step 6: Commit the route/UI slice**

```bash
git add 'src/app/(vitrina)/catalog' 'src/app/(vitrina)/ru/catalog'
git commit -m "feat: add russian public catalog routes"
```

---

### Task 5: Set document language and publish SEO discovery

**Files:**
- Create: `src/lib/vitrina/request-locale.ts`
- Create: `src/lib/vitrina/__tests__/request-locale.test.ts`
- Modify: `proxy.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/robots.ts`
- Create: `src/app/sitemap.ts`
- Modify: `.env.example`
- Create: `src/app/__tests__/catalog-seo.test.ts`

**Interfaces:**
- Produces: `PUBLIC_LOCALE_HEADER = "x-nadin-public-locale"` and `publicLocaleFromPath(pathname)`.
- Consumes: shared catalog URLs and Prisma sitemap rows.

- [ ] **Step 1: Write failing request-locale and SEO tests**

Test these exact cases:

```ts
assert.equal(publicLocaleFromPath("/ru/catalog"), "ru");
assert.equal(publicLocaleFromPath("/ru/catalog/piesa/p1"), "ru");
assert.equal(publicLocaleFromPath("/catalog"), "ro");
assert.equal(publicLocaleFromPath("/crm"), "ro");
```

The SEO source test must assert `robots.ts` includes both `/catalog` and `/ru/catalog`, and `sitemap.ts` emits `alternates.languages.ro` and `.ru`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test src/lib/vitrina/__tests__/request-locale.test.ts src/app/__tests__/catalog-seo.test.ts`

Expected: FAIL because helper and sitemap do not exist.

- [ ] **Step 3: Propagate locale from proxy to root layout**

Create a public-path helper, wrap the existing Neon auth middleware, and for `/catalog`, `/ru/catalog`, and their descendants return `NextResponse.next` with `x-nadin-public-locale`. All non-public matched paths continue through the existing auth middleware. In `RootLayout`, call `headers()` and set `<html lang={header === "ru" ? "ru" : "ro"}>`.

Keep assets, auth endpoints, `robots.txt`, and `sitemap.xml` excluded from the matcher.

- [ ] **Step 4: Add robots, sitemap, and base URL configuration**

Add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to `.env.example`; deployment overrides it with the production origin. `sitemap.ts` must build absolute URLs from `NEXT_PUBLIC_SITE_URL`, falling back to `http://localhost:3000`, and include the home, search, brand, model, and product pages in both languages with alternates. `robots.ts` allows both catalog prefixes and disallows `/crm` and `/auth`.

- [ ] **Step 5: Verify GREEN and build safety**

Run:

```bash
pnpm test src/lib/vitrina/__tests__/request-locale.test.ts src/app/__tests__/catalog-seo.test.ts
pnpm exec tsc --noEmit
pnpm build
```

Expected: tests, TypeScript, and production build pass; build output lists Romanian and Russian catalog routes plus `/sitemap.xml`.

- [ ] **Step 6: Commit SEO and language propagation**

```bash
git add proxy.ts src/app/layout.tsx src/app/robots.ts src/app/sitemap.ts .env.example src/lib/vitrina/request-locale.ts src/lib/vitrina/__tests__/request-locale.test.ts src/app/__tests__/catalog-seo.test.ts
git commit -m "feat: publish localized catalog metadata"
```

---

### Task 6: Backfill current Russian catalog data safely

**Files:**
- Create: `src/lib/vitrina/russian-translation.ts`
- Create: `src/lib/vitrina/__tests__/russian-translation.test.ts`
- Create: `scripts/backfill-russian-catalog.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `translateCatalogText(source): { value: string | null; unresolved: string[] }`.
- Produces: `pnpm catalog:backfill-ru -- --dry-run` and `pnpm catalog:backfill-ru`.
- Consumes: Russian Prisma columns from Task 1.

- [ ] **Step 1: Write failing deterministic translation tests**

Cover representative catalog grammar while preserving codes and side markers:

```ts
assert.equal(translateCatalogText("Prag 4/5uși L").value, "Порог 4/5 дверей левый");
assert.equal(translateCatalogText("Aripa fata dreapta").value, "Переднее правое крыло");
assert.equal(translateCatalogText("Far H7 2008-").value, "Фара H7 с 2008 г.");
assert.deepEqual(translateCatalogText("XQZ termen necunoscut").unresolved, ["termen", "necunoscut"]);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test src/lib/vitrina/__tests__/russian-translation.test.ts`

Expected: FAIL because the translator does not exist.

- [ ] **Step 3: Implement a curated deterministic translator**

Use ordered whole-phrase and token rules for the actual catalog vocabulary. Normalize whitespace, preserve product/model codes and numbers, translate Romanian/French part terms, positions, sides, door counts, body styles, and year markers, then report alphabetic tokens not present in the curated vocabulary. Never invent a translation for an unresolved token.

The function returns `value: null` whenever unresolved tokens could change the meaning; safe codes/numbers do not count as unresolved.

- [ ] **Step 4: Implement idempotent dry-run/apply script**

The script queries only rows with empty Russian fields, translates product descriptions/notes, type names, and fitment labels, and prints:

```text
products: translated=<n> unresolved=<n> skipped=<n>
types: translated=<n> unresolved=<n> skipped=<n>
fitments: translated=<n> unresolved=<n> skipped=<n>
```

With `--dry-run`, it performs no updates and prints each unresolved original once. Without it, update rows only where the Russian field is still `null` or empty in the update predicate.

- [ ] **Step 5: Run dry-run and close the vocabulary gaps**

Run: `pnpm catalog:backfill-ru -- --dry-run`

Add explicit phrase/token rules for every safely translatable unresolved catalog term and rerun until only genuine codes, proper nouns, or ambiguous source errors remain. Ambiguous values stay unresolved and appear in the final report for manual CRM correction.

- [ ] **Step 6: Apply schema and backfill**

Run:

```bash
pnpm db:push
pnpm catalog:backfill-ru
pnpm catalog:backfill-ru -- --dry-run
```

Expected: the first two commands succeed; the last dry-run reports `translated=0` and lists only the same explicitly ambiguous values, proving idempotence and preservation of saved values.

- [ ] **Step 7: Verify and commit the backfill tooling**

Run:

```bash
pnpm test src/lib/vitrina/__tests__/russian-translation.test.ts
pnpm exec tsc --noEmit
```

Then:

```bash
git add src/lib/vitrina/russian-translation.ts src/lib/vitrina/__tests__/russian-translation.test.ts scripts/backfill-russian-catalog.ts package.json
git commit -m "feat: backfill russian catalog content"
```

---

### Task 7: Full catalog verification

**Files:**
- Modify only files needed to fix failures directly caused by Tasks 1–6.

**Interfaces:**
- Consumes: the complete Russian catalog feature.
- Produces: evidence for every catalog acceptance criterion.

- [ ] **Step 1: Run automated verification**

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Expected: all commands exit 0 without new warnings.

- [ ] **Step 2: Run route smoke checks**

Start `pnpm dev:http`, open `/sitemap.xml`, and use the first listed brand,
model, and product URLs to verify HTTP 200 and Russian text for all of these
route shapes:

```text
/catalog
/ru/catalog
/ru/catalog/cauta?q=порог
/ru/catalog/{first brand slug from sitemap}
/ru/catalog/{first brand slug}/{first model slug from sitemap}
/ru/catalog/piesa/{first product ID from sitemap}
```

Verify the RO/RU switch preserves brand/model/product context and query parameters.

- [ ] **Step 3: Verify responsive UI and metadata**

At desktop and mobile widths, inspect home, search results, model product grid, and product detail in both languages. Confirm Cyrillic uses the bundled Manrope face, no copy overflows, `<html lang>` is correct, and canonical/hreflang values match the current path.

- [ ] **Step 4: Re-run the owning task after any verification fix**

If verification exposes a defect, return to the task that owns that behavior,
repeat its RED/GREEN checks, and include the exact corrected file in that
task's commit. When no defect is found, no additional commit is created.
