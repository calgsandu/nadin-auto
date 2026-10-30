"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

type Position = { top?: number; bottom?: number; right?: number; left?: number };

/**
 * Meniul „⋯" al unui rând de tabel: acțiunile rare (editare, ștergere, export)
 * stau aici, nu ca trei butoane pe fiecare rând.
 *
 * Copiii sunt componentele de acțiune existente (fiecare cu dialogul lui);
 * `.row-menu-panel` din `globals.css` le dă aspect de rând de meniu. Se
 * montează abia la prima deschidere — un tabel de 50 de rânduri nu mai
 * pornește 150 de dialoguri — și rămân montate apoi, ca un drawer deschis
 * din meniu să nu dispară când meniul se închide.
 *
 * Panoul e portat în `body` cu poziție fixă: în celula tabelului ar fi tăiat
 * de `overflow-x-auto`, iar animația paginii (transform) ar muta `fixed`.
 */
export function RowMenu({
  label,
  children,
  icon: Icon = MoreHorizontal,
  badge = 0,
  ariaLabel,
  size = "row",
}: {
  label: string;
  children: ReactNode;
  /** Altă iconiță decât „⋯" (ex. clopoțelul din antet). */
  icon?: LucideIcon;
  /** Număr afișat pe buton (ex. câte lucruri sunt de făcut). */
  badge?: number;
  ariaLabel?: string;
  /** "row" = buton mic de rând de tabel, "header" = buton de antet. */
  size?: "row" | "header";
}) {
  const [used, setUsed] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Aliniat la dreapta butonului; lângă marginea stângă (meniul contului din
    // sidebar-ul restrâns) s-ar deschide în afara ecranului, deci la stânga.
    const side = rect.left < 240 ? { left: rect.left } : { right: window.innerWidth - rect.right };
    // Pe ultimele rânduri ale ecranului meniul se deschide în sus.
    setPosition(
      rect.bottom > window.innerHeight - 200
        ? { bottom: window.innerHeight - rect.top + 4, ...side }
        : { top: rect.bottom + 4, ...side },
    );
    setUsed(true);
  }

  return (
    <>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel ?? `Mai multe acțiuni: ${label}`}
        className={`button-secondary relative grid place-items-center rounded-md border border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b] ${
          size === "header" ? "size-9 rounded-lg" : "size-7"
        }`}
        title={ariaLabel ?? "Mai multe acțiuni"}
        type="button"
        onClick={toggle}
      >
        <Icon className="size-4" aria-hidden="true" />
        {badge > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[#2563eb] px-1 text-[10px] font-bold leading-4 tabular-nums text-white">
            {badge}
          </span>
        ) : null}
      </button>
      {used
        ? createPortal(
            <div
              ref={panelRef}
              className="row-menu-panel motion-popover fixed z-[45] grid min-w-44 gap-0.5 rounded-lg border border-[#e4e4e7] bg-white p-1 shadow-lg"
              role="menu"
              style={open ? position : { display: "none" }}
              // Un click pe o acțiune închide meniul; dialogul ei rămâne deschis.
              onClick={() => setPosition(null)}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
