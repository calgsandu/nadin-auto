"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Car, Printer, ShoppingCart, Warehouse } from "lucide-react";
import { CopyCode } from "@/app/components/copy-code";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { drawerPanelClassName } from "@/app/components/operation-drawer";
import { CloseIconButton } from "@/app/components/icon-buttons";

export type ProductPreviewValue = {
  id: string;
  code: string | null;
  alternativeCode: string | null;
  description: string;
  type: string;
  compatibilities: { title: string; years: string; logo?: string | null }[];
  stocks: { id: string; name: string; quantity: number }[];
  total: number;
  price: string | null;
  notes: string | null;
};

/**
 * Fișa rapidă a unui produs, pentru biroul cu clientul în față: prețul,
 * stocul pe fiecare depozit și toate mașinile pe care se potrivește. Costul nu
 * apare — ecranul e adesea întors spre client.
 */
export function ProductPreview({
  product,
  canSell,
  canModify,
  editButton,
  children,
}: {
  product: ProductPreviewValue;
  canSell: boolean;
  canModify: boolean;
  /** Dialogul de editare (randat de server, cu listele lui); după salvare fișa se reîmprospătează singură. */
  editButton?: React.ReactNode;
  /** Conținutul butonului (rândul de rezultat întreg e clicabil). */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        className="block w-full text-left"
        type="button"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open ? (
        <DrawerPortal>
          <div className="motion-drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/30">
            <button
              aria-label="Închide fișa produsului"
              className="absolute inset-0 cursor-default"
              type="button"
              onClick={() => setOpen(false)}
            />
            <aside aria-label={product.description} className={drawerPanelClassName.replace("md:max-w-[90vw]", "md:max-w-2xl")}>
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-(--c-line) bg-(--c-surface-2) px-5 py-3">
                <div className="min-w-0">
                  {product.code ? (
                    <p className="font-mono text-xl font-bold text-(--c-ink)">
                      <CopyCode code={product.code} />
                      {product.alternativeCode ? (
                        <span className="ml-2 text-sm font-medium text-(--c-muted-2)">{product.alternativeCode}</span>
                      ) : null}
                    </p>
                  ) : null}
                  <h2 className="text-lg font-semibold tracking-tight text-(--c-ink)">{product.description}</h2>
                  <p className="text-sm text-(--c-muted)">{product.type}</p>
                </div>
                <CloseIconButton onClick={() => setOpen(false)} />
              </div>

              <div className="grid gap-4 px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-(--c-accent) p-4 text-white">
                  <div>
                    <p className="text-sm text-white/70">Preț de vânzare</p>
                    <p className="text-3xl font-semibold tracking-tight tabular-nums">
                      {product.price ?? "fără preț"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canModify ? editButton : null}
                    {canModify ? (
                      <a
                        className="button-secondary inline-flex h-10 items-center gap-2 rounded-md border border-(--c-line) bg-(--c-surface) px-3 text-sm font-medium text-(--c-ink) hover:bg-(--c-hover)"
                        href={`/print/labels?ids=${product.id}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Printer className="size-4" aria-hidden="true" /> Sticker
                      </a>
                    ) : null}
                    {canSell ? (
                      <Link
                        className="inline-flex h-10 items-center gap-2 rounded-md bg-(--c-accent) px-4 text-sm font-semibold text-white hover:bg-(--c-accent-hover)"
                        href={`/crm/vanzari?nou=1&produs=${product.id}`}
                      >
                        <ShoppingCart className="size-4" aria-hidden="true" /> Vinde
                      </Link>
                    ) : null}
                  </div>
                </div>

                <section className="crm-card">
                  <h3 className="flex items-center gap-2.5 border-b border-(--c-line-2) px-4 py-2.5 text-sm font-semibold text-(--c-ink)">
                    <span className="grid size-7 place-items-center rounded-lg bg-(--c-accent-soft) text-(--c-accent)">
                      <Car className="size-4" aria-hidden="true" />
                    </span>
                    Se potrivește pe
                  </h3>
                  <ul className="divide-y divide-(--c-hover)">
                    {product.compatibilities.map((compatibility) => (
                      <li
                        key={`${compatibility.title}:${compatibility.years}`}
                        className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2.5 font-medium text-(--c-ink)">
                          {compatibility.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={compatibility.logo} alt="" className="size-5 shrink-0 object-contain dark:rounded-sm dark:bg-white dark:p-px" />
                          ) : null}
                          {compatibility.title}
                        </span>
                        <span className="text-(--c-muted)">{compatibility.years}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="crm-card">
                  <h3 className="flex items-center justify-between border-b border-(--c-line-2) px-4 py-2.5 text-sm font-semibold text-(--c-ink)">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-7 place-items-center rounded-lg bg-(--c-accent-soft) text-(--c-accent)">
                        <Warehouse className="size-4" aria-hidden="true" />
                      </span>
                      Stoc pe depozite
                    </span>
                    <span className="font-normal text-(--c-muted)">
                      total <span className="font-semibold text-(--c-ink)">{product.total}</span> buc.
                    </span>
                  </h3>
                  <ul className="grid sm:grid-cols-2">
                    {/* Întâi depozitele unde chiar e marfă. */}
                    {[...product.stocks].sort((a, b) => b.quantity - a.quantity).map((stock) => (
                      <li
                        key={stock.id}
                        className="flex items-center justify-between gap-3 border-b border-(--c-hover) px-4 py-2 text-sm"
                      >
                        <span className="text-(--c-ink-2)">{stock.name}</span>
                        <span
                          className={`min-w-8 rounded-md px-1.5 text-center font-semibold tabular-nums ${
                            stock.quantity > 0 ? "bg-(--c-green-soft) text-(--c-green)" : "text-(--c-faint)"
                          }`}
                        >
                          {stock.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                {product.notes ? (
                  <p className="crm-card p-4 text-sm text-(--c-ink)">{product.notes}</p>
                ) : null}
              </div>
            </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}
