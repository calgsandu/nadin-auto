# Imagini produse

Pune aici pozele reale ale pieselor, numite după codul piesei trecut prin
slugify (litere mici, orice alt caracter devine `-`):

- `131501` → `131501.jpg`
- `P11323 1` → `p11323-1.jpg`
- `T0014011` → `t0014011.webp`

Formate acceptate: `.webp`, `.jpg`, `.png` (în ordinea asta de preferință).
Site-ul le preia automat pe pagina piesei și pe cardurile din model
(`src/lib/vitrina/images.ts`). După ce adaugi poze noi: restart dev / redeploy.

Sursa recomandată: pachetul foto oficial Polcar pentru parteneri B2B —
catalogul lor public nu se scrape-uiește (Cloudflare Turnstile + copyright).
