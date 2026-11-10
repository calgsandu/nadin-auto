"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ClipboardCheck,
  PackageMinus,
  PackagePlus,
  Search,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DrawerPortal } from "@/app/components/drawer-portal";
import {
  prepareQuickIndex,
  searchQuickCustomers,
  searchQuickIndex,
  type QuickCustomer,
  type QuickIndex,
  type QuickProduct,
} from "@/lib/catalog/quick-index";
import { normalizeText } from "@/lib/catalog/search-text";
import { crmCatalogPageHref, crmCustomersHref, crmSectionHref } from "@/lib/crm/urls";
import { navigationGroups, sectionLabel, type WorkspaceSectionId } from "@/lib/operations/workspace";
import { canViewSection } from "@/lib/roles";
import type { AppRole } from "@/generated/prisma/enums";
import { formatMoney } from "./format";
import { sectionIcon } from "./section-icons";

const OPEN_EVENT = "crm:palette";

/** Deschide paleta din orice buton (meniu, antet). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type LinkItem = { kind: "link"; key: string; label: string; hint?: string; href: string; icon: LucideIcon };
type ProductItem = { kind: "product"; key: string; product: QuickProduct };
type Item = LinkItem | ProductItem;
type Group = { label: string; items: Item[] };

const ACTIONS: Array<{ section: WorkspaceSectionId; label: string; href: string; icon: LucideIcon }> = [
  { section: "vanzari", label: "Vânzare nouă", href: "/crm/vanzari?nou=1", icon: ShoppingCart },
  { section: "receptii", label: "Recepție nouă", href: "/crm/receptii?nou=1", icon: PackagePlus },
  { section: "transferuri", label: "Transfer nou", href: "/crm/transferuri?nou=1", icon: ArrowRightLeft },
  { section: "inventar", label: "Corectează stocul", href: "/crm/inventar?nou=1", icon: ClipboardCheck },
  { section: "receptii", label: "Piese aproape terminate", href: "/crm/produse?stoc=mic", icon: PackageMinus },
];

/*
 * Indexul trăiește la nivel de modul: layout-ul CRM supraviețuiește navigării,
 * deci catalogul se descarcă o dată și rămâne în memorie între deschideri.
 */
type Loaded = {
  at: number;
  warehouses: string[];
  prepared: ReturnType<typeof prepareQuickIndex>;
  customers: QuickCustomer[];
};
let cache: Loaded | null = null;
let pending: Promise<Loaded | null> | null = null;
const MAX_AGE = 60_000;

function loadIndex() {
  pending ??= fetch("/api/products/index")
    .then((response) => (response.ok ? (response.json() as Promise<QuickIndex>) : null))
    .then((index) => {
      if (index) {
        cache = {
          at: Date.now(),
          warehouses: index.warehouses,
          prepared: prepareQuickIndex(index.products),
          customers: index.customers,
        };
      }
      return cache;
    })
    .catch(() => cache)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Ultimele piese deschise din paletă: clientul pleacă, se întoarce, întreabă iar. */
const RECENT_KEY = "nadin-palette-recent";
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id) => typeof id === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function rememberRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((other) => other !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Fără localStorage (mod privat): paleta merge și fără „Recente".
  }
}

/**
 * Paleta de comenzi (Ctrl+K): piesa, prețul și stocul ei din orice ecran, plus
 * salt la orice secțiune și la operațiunile zilnice — fără mouse.
 *
 * Produsele se caută în browser, într-un index ținut în memorie: rezultatele
 * apar la fiecare literă, fără drum la server.
 */
export function CommandPalette({ role }: { role: AppRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<Loaded | null>(cache);
  const [recent, setRecent] = useState<string[]>([]);
  const activeRef = useRef<HTMLLIElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Încălzire: prima deschidere găsește catalogul deja în memorie.
  useEffect(() => {
    const timer = window.setTimeout(() => void loadIndex().then(setIndex), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const show = () => {
      restoreFocus.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActive(0);
      setRecent(readRecent());
      setOpen(true);
      if (!cache || Date.now() - cache.at > MAX_AGE) void loadIndex().then(setIndex);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      // Cu un panou de operațiune deschis nu apare: ar acoperi ciorna în lucru.
      const drawerOpen = Array.from(document.querySelectorAll<HTMLElement>(".motion-drawer-backdrop")).some(
        (backdrop) => backdrop.style.display !== "none",
      );
      if (drawerOpen) return;
      event.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, show);
    };
  }, []);

  const groups = useMemo<Group[]>(() => {
    const wanted = normalizeText(query.trim());
    const matches = (label: string) => !wanted || normalizeText(label).includes(wanted);

    const actions: Item[] = ACTIONS.filter((action) => canViewSection(role, action.section) && matches(action.label)).map(
      (action) => ({ kind: "link", key: action.href, label: action.label, href: action.href, icon: action.icon }),
    );
    const sections: Item[] = navigationGroups
      .flatMap((group) => group.sections)
      .filter((section) => canViewSection(role, section) && matches(sectionLabel(section)))
      .map((section) => ({
        kind: "link",
        key: section,
        label: sectionLabel(section),
        href: crmSectionHref(section),
        icon: sectionIcon(section),
      }));
    const products: Item[] =
      wanted && index
        ? searchQuickIndex(index.prepared, query).map((product) => ({ kind: "product", key: product.id, product }))
        : [];
    const recents: Item[] =
      !wanted && index
        ? recent.flatMap((id) => {
            const product = index.prepared.find((entry) => entry.product.id === id)?.product;
            return product ? [{ kind: "product" as const, key: product.id, product }] : [];
          })
        : [];
    const customers: Item[] = index
      ? searchQuickCustomers(index.customers, query).map((customer) => ({
          kind: "link",
          key: `client-${customer.id}`,
          label: customer.name,
          hint: customer.phone ?? undefined,
          href: crmCustomersHref(customer.id),
          icon: Users,
        }))
      : [];
    // Indexul ține primele potriviri; lista întreagă, cu filtre, e în Produse.
    const more: Item[] = wanted
      ? [
          {
            kind: "link",
            key: "toate",
            label: `Toate rezultatele pentru „${query.trim()}”`,
            href: crmCatalogPageHref({ q: query.trim() }),
            icon: Search,
          },
        ]
      : [];

    return [
      { label: "Produse", items: products },
      { label: "Clienți", items: customers },
      { label: "Recente", items: recents },
      { label: "Operațiuni", items: actions },
      { label: "Mergi la", items: sections },
      { label: "", items: more },
    ].filter((group) => group.items.length > 0);
  }, [index, query, recent, role]);

  const items = groups.flatMap((group) => group.items);
  const current = items[Math.min(active, items.length - 1)];

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active, query]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    restoreFocus.current?.focus();
  };
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const run = (item: Item | undefined, sell = false) => {
    if (!item) return;
    if (item.kind === "link") return go(item.href);
    rememberRecent(item.product.id);
    if (sell) return go(`/crm/vanzari?nou=1&produs=${item.product.id}`);
    go(crmCatalogPageHref({ q: item.product.code ?? item.product.description }));
  };
  const stocksLine =
    current?.kind === "product" && index
      ? current.product.stocks
          .map((quantity, position) => (quantity > 0 ? `${index.warehouses[position]}: ${quantity}` : null))
          .filter(Boolean)
          .join(", ")
      : "";

  return (
    <DrawerPortal>
      <div
        className="command-palette-backdrop fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-3 sm:pt-[12vh]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Caută piese și comenzi"
          className="motion-popover flex max-h-[min(80dvh,34rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgb(24_24_27/0.35)] ring-1 ring-black/10"
        >
          <div className="flex items-center gap-2.5 border-b border-[#e4e4e7] px-4">
            <Search className="size-4 shrink-0 text-[#71717a]" aria-hidden="true" />
            <input
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-list"
              aria-activedescendant={current ? `command-palette-${current.key}` : undefined}
              aria-label="Caută cod, piesă, mașină sau secțiune"
              autoComplete="off"
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#a1a1aa]"
              enterKeyHint="go"
              placeholder="Cod, piesă, mașină sau secțiune"
              value={query}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (items.length === 0) return;
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setActive((value) => (Math.min(value, items.length - 1) + step + items.length) % items.length);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  run(current, event.ctrlKey || event.metaKey);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                } else if (event.key === "Tab") {
                  // Un singur câmp: Tab ar scoate focusul în pagina de dedesubt.
                  event.preventDefault();
                }
              }}
            />
            <button
              type="button"
              className="rounded border border-[#e4e4e7] px-1.5 py-0.5 text-xs text-[#71717a] hover:bg-[#f4f4f5]"
              onClick={close}
            >
              Esc
            </button>
          </div>

          <ul id="command-palette-list" role="listbox" aria-label="Rezultate" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {groups.map((group) => (
              <li key={group.label} role="presentation">
                {group.label ? <p className="px-2.5 pb-1 pt-2 text-xs text-[#71717a]">{group.label}</p> : null}
                <ul role="presentation">
                  {group.items.map((item) => {
                    const here = items.indexOf(item);
                    const selected = item === current;
                    return (
                      <li
                        key={item.key}
                        id={`command-palette-${item.key}`}
                        ref={selected ? activeRef : undefined}
                        role="option"
                        aria-selected={selected}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${
                          selected ? "bg-[#eff6ff]" : ""
                        }`}
                        onMouseMove={() => setActive(here)}
                        onClick={(event) => run(item, event.ctrlKey || event.metaKey)}
                      >
                        {item.kind === "product" ? <ProductOption product={item.product} /> : <LinkOption item={item} />}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {query.trim() && !index ? (
              <li role="presentation" className="px-2.5 py-2 text-sm text-[#71717a]">
                Se încarcă produsele…
              </li>
            ) : null}
          </ul>

          <div
            className={`flex items-center justify-between gap-4 border-t border-[#e4e4e7] bg-[#fafafa] px-4 py-2 text-xs text-[#52525b] ${
              stocksLine ? "" : "max-sm:hidden"
            }`}
          >
            <span className="min-w-0 truncate">{stocksLine}</span>
            <span className="flex shrink-0 gap-3 max-sm:hidden">
              <span>↵ deschide</span>
              {current?.kind === "product" ? <span>Ctrl ↵ vinde</span> : null}
            </span>
          </div>
        </div>
      </div>
    </DrawerPortal>
  );
}

function LinkOption({ item }: { item: LinkItem }) {
  const Icon = item.icon;
  return (
    <>
      <Icon className="size-4 shrink-0 text-[#71717a]" aria-hidden="true" />
      <span className="min-w-0 truncate font-medium text-[#18181b]">{item.label}</span>
      {item.hint ? <span className="ml-auto shrink-0 tabular-nums text-[#71717a]">{item.hint}</span> : null}
    </>
  );
}

function ProductOption({ product }: { product: QuickProduct }) {
  return (
    <>
      <span className="w-[5.5rem] shrink-0 truncate font-mono text-[13px] font-bold text-[#18181b]">
        {product.code ?? "—"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[#18181b]">{product.description}</span>
        <span className="block truncate text-xs text-[#71717a]">{product.vehicles}</span>
      </span>
      {product.price != null ? (
        <span className="shrink-0 font-semibold tabular-nums text-[#18181b]">
          {formatMoney(product.price)} <span className="text-xs font-normal text-[#a1a1aa]">lei</span>
        </span>
      ) : null}
      <span
        className={`min-w-8 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[13px] font-semibold tabular-nums ${
          product.stock > 0 ? "bg-[#f0fdf4] text-[#166534]" : "bg-[#fef2f2] text-[#b91c1c]"
        }`}
        title={product.stock > 0 ? "În stoc" : "Fără stoc"}
      >
        {product.stock}
      </span>
    </>
  );
}
