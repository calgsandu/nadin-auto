"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Printer, ShoppingCart } from "lucide-react";
import { CopyCode } from "@/app/components/copy-code";
import { DrawerPortal } from "@/app/components/drawer-portal";
import { drawerPanelClassName } from "@/app/components/operation-drawer";

export type ProductPreviewValue = {
  id: string;
  code: string | null;
  alternativeCode: string | null;
  description: string;
  type: string;
  compatibilities: { title: string; years: string }[];
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
  children,
}: {
  product: ProductPreviewValue;
  canSell: boolean;
  canModify: boolean;
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
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e4e4e7] bg-[#fafafa] px-5 py-3">
                <div className="min-w-0">
                  {product.code ? (
                    <p className="font-mono text-xl font-bold text-[#18181b]">
                      <CopyCode code={product.code} />
                      {product.alternativeCode ? (
                        <span className="ml-2 text-sm font-medium text-[#71717a]">{product.alternativeCode}</span>
                      ) : null}
                    </p>
                  ) : null}
                  <h2 className="text-lg font-semibold tracking-tight text-[#18181b]">{product.description}</h2>
                  <p className="text-sm text-[#52525b]">{product.type}</p>
                </div>
                <button
                  className="button-secondary rounded-md border border-[#e4e4e7] bg-white px-3 py-2 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Închide
                </button>
              </div>

              <div className="grid gap-4 px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#e4e4e7] bg-white p-4">
                  <div>
                    <p className="text-sm text-[#52525b]">Preț de vânzare</p>
                    <p className="text-3xl font-semibold tracking-tight tabular-nums text-[#18181b]">
                      {product.price ?? "fără preț"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canModify ? (
                      <a
                        className="button-secondary inline-flex h-10 items-center gap-2 rounded-md border border-[#e4e4e7] bg-white px-3 text-sm font-medium text-[#18181b] hover:bg-[#f4f4f5]"
                        href={`/print/labels?ids=${product.id}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Printer className="size-4" aria-hidden="true" /> Sticker
                      </a>
                    ) : null}
                    {canSell ? (
                      <Link
                        className="button-primary inline-flex h-10 items-center gap-2 rounded-md bg-[#18181b] px-4 text-sm font-semibold text-white hover:bg-[#27272a]"
                        href={`/crm/vanzari?nou=1&produs=${product.id}`}
                      >
                        <ShoppingCart className="size-4" aria-hidden="true" /> Vinde
                      </Link>
                    ) : null}
                  </div>
                </div>

                <section className="rounded-xl border border-[#e4e4e7] bg-white">
                  <h3 className="border-b border-[#f0f0f2] px-4 py-2.5 text-sm font-semibold text-[#18181b]">
                    Se potrivește pe
                  </h3>
                  <ul className="divide-y divide-[#f4f4f5]">
                    {product.compatibilities.map((compatibility) => (
                      <li
                        key={`${compatibility.title}:${compatibility.years}`}
                        className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm"
                      >
                        <span className="font-medium text-[#18181b]">{compatibility.title}</span>
                        <span className="text-[#52525b]">{compatibility.years}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-xl border border-[#e4e4e7] bg-white">
                  <h3 className="flex items-baseline justify-between border-b border-[#f0f0f2] px-4 py-2.5 text-sm font-semibold text-[#18181b]">
                    Stoc pe depozite
                    <span className="font-normal text-[#52525b]">
                      total <span className="font-semibold text-[#18181b]">{product.total}</span> buc.
                    </span>
                  </h3>
                  <ul className="grid sm:grid-cols-2">
                    {/* Întâi depozitele unde chiar e marfă. */}
                    {[...product.stocks].sort((a, b) => b.quantity - a.quantity).map((stock) => (
                      <li
                        key={stock.id}
                        className="flex items-center justify-between gap-3 border-b border-[#f4f4f5] px-4 py-2 text-sm"
                      >
                        <span className="text-[#3f3f46]">{stock.name}</span>
                        <span
                          className={`min-w-8 rounded-md px-1.5 text-center font-semibold tabular-nums ${
                            stock.quantity > 0 ? "bg-[#f0fdf4] text-[#166534]" : "text-[#a1a1aa]"
                          }`}
                        >
                          {stock.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                {product.notes ? (
                  <p className="rounded-xl border border-[#e4e4e7] bg-white p-4 text-sm text-[#18181b]">{product.notes}</p>
                ) : null}
              </div>
            </aside>
          </div>
        </DrawerPortal>
      ) : null}
    </>
  );
}
