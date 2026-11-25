import fs from "node:fs";
import path from "node:path";
import { slugify } from "@/lib/vitrina/slug";

/**
 * Imagini reale per produs: pune fișiere în public/produse/ numite după codul
 * piesei trecut prin slugify (ex. "P11323 1" -> p11323-1.jpg). Suportă
 * webp/jpg/png. Sursa oficială: pachetul foto B2B Polcar (nu se scrape-uiește
 * catalogul lor — e protejat cu Turnstile și e copyright).
 */
const PRODUCT_DIR = path.join(process.cwd(), "public", "produse");

// ponytail: cache pe proces; după ce adaugi poze noi, restart dev/redeploy
let fileCache: Set<string> | null = null;

function productFiles(): Set<string> {
  if (!fileCache) {
    try {
      fileCache = new Set(fs.readdirSync(PRODUCT_DIR));
    } catch {
      fileCache = new Set();
    }
  }
  return fileCache;
}

export function productImage(code: string | null): string | null {
  if (!code) return null;
  const base = slugify(code);
  if (!base) return null;
  for (const ext of ["webp", "jpg", "png"]) {
    if (productFiles().has(`${base}.${ext}`)) return `/produse/${base}.${ext}`;
  }
  return null;
}

// ponytail: cache brand-logo filenames per process like product files
let logoCache: Set<string> | null = null;
const LOGO_DIR = path.join(process.cwd(), "public", "branduri");

/** Logo real al mărcii (public/branduri/<slug>.png), null dacă lipsește. */
export function brandLogo(brandSlug: string): string | null {
  if (!logoCache) {
    try {
      logoCache = new Set(fs.readdirSync(LOGO_DIR));
    } catch {
      logoCache = new Set();
    }
  }
  return logoCache.has(`${brandSlug}.png`) ? `/branduri/${brandSlug}.png` : null;
}

// ponytail: cache model-image filenames per process
let modelCache: Set<string> | null = null;
const MODEL_DIR = path.join(process.cwd(), "public", "modele");

/** Poză reală a modelului (public/modele/<brand>__<model>.jpg), null dacă lipsește. */
export function modelImage(brandSlug: string, modelSlug: string): string | null {
  if (!modelCache) {
    try {
      modelCache = new Set(fs.readdirSync(MODEL_DIR));
    } catch {
      modelCache = new Set();
    }
  }
  const name = `${brandSlug}__${modelSlug}.jpg`;
  return modelCache.has(name) ? `/modele/${name}` : null;
}
