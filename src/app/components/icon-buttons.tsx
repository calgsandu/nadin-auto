import { Check, Loader2, X } from "lucide-react";
import type { ComponentProps } from "react";

/**
 * Iconițe peste tot, combinate cu un cuvânt unde ajută: „Închide" e doar un X,
 * „Salvează" e bifă + cuvântul scurt. Numele complet rămâne în `aria-label`
 * (cititoare de ecran, teste) și în `title` (apare la hover, cu scurtătura).
 */

/** Pătrat mic, contur — pentru acțiunile de pe rânduri (editează, detalii, PDF…). */
export const rowIconButtonCls =
  "button-secondary relative inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[#e4e4e7] bg-white text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#18181b] disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4";

/** Același pătrat, roșu — pentru ștergere. */
export const rowDangerIconButtonCls =
  "button-secondary relative inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[#fca5a5] bg-white text-[#b91c1c] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4";

const closeCls =
  "button-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[#e4e4e7] bg-white text-[#52525b] hover:bg-[#f4f4f5] hover:text-[#18181b]";

const saveCls =
  "button-primary inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#18181b] px-3.5 text-sm font-semibold text-white hover:bg-[#27272a] disabled:cursor-not-allowed disabled:opacity-60";

export function CloseIconButton({
  label = "Închide",
  ...props
}: { label?: string } & Omit<ComponentProps<"button">, "children">) {
  return (
    <button className={closeCls} title={`${label} (Esc)`} aria-label={label} type="button" {...props}>
      <X className="size-4.5" aria-hidden="true" />
    </button>
  );
}

/** „Salvează vânzarea" → „Salvează": pe buton cuvântul scurt, în tooltip numele complet. */
function shortLabel(label: string) {
  const [first] = label.split(" ");
  return first === "Salvează" || first === "Adaugă" ? first : label;
}

/** Bifă + cuvânt scurt (Salvează / Adaugă / Livrează…). */
export function SaveButton({
  label,
  pending,
  ...props
}: { label: string; pending?: boolean } & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      className={saveCls}
      disabled={pending}
      title={`${label} (Ctrl+Enter)`}
      aria-label={pending ? "Se salvează..." : label}
      type="button"
      {...props}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Check className="size-4" strokeWidth={2.75} aria-hidden="true" />
      )}
      <span aria-hidden="true">{pending ? "Se salvează" : shortLabel(label)}</span>
    </button>
  );
}

/** Eticheta unei acțiuni de rând: invizibilă, dar citită de cititoare și teste. */
export function IconLabel({ children }: { children: string }) {
  return <span className="sr-only">{children}</span>;
}
