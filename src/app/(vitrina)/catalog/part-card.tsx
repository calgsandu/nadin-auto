import Link from "next/link";
import Image from "next/image";
import { productImage } from "@/lib/vitrina/images";
import { catalogCopy, catalogHref, type CatalogLocale } from "@/lib/vitrina/i18n";

/**
 * Cardul unei piese din vitrină (model, căutare, „alte piese”). Toate cardurile
 * au aceeași formă — zonă de imagine fixă, apoi cod, denumire, compatibilitate —
 * ca grila să stea dreaptă și când doar unele piese au poză. Fără etichete,
 * puncte sau contoare: doar textul de care are nevoie cumpărătorul.
 */
export function PartCard({
  locale,
  part,
  meta,
  priority = false,
}: {
  locale: CatalogLocale;
  part: {
    id: string;
    code: string | null;
    description: string;
    inStock: boolean;
    isLocal: boolean;
    fitLabel?: string;
  };
  /** Rândul mic de sub denumire: compatibilitatea sau mașina + tipul. */
  meta?: string;
  priority?: boolean;
}) {
  const image = productImage(part.code);
  const subtitle = meta ?? part.fitLabel;

  return (
    <Link
      href={catalogHref(locale, `/piesa/${part.id}`)}
      data-stagger
      className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-(--c-line) bg-(--c-surface) transition-colors hover:border-(--c-accent)/50"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-(--c-line-2) bg-white">
        {image ? (
          <Image
            src={image}
            alt={part.description}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-3"
          />
        ) : (
          <PartPlaceholder locale={locale} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="truncate font-mono text-xs text-(--c-muted)">{part.code ?? "—"}</p>
        <p className="mt-1 line-clamp-2 text-[15px] font-medium leading-snug text-(--c-ink) group-hover:text-(--c-accent)">
          {part.description}
        </p>
        <div className="mt-auto pt-2">
          {subtitle ? (
            <p className="line-clamp-1 text-[13px] text-(--c-muted-2)">{subtitle}</p>
          ) : null}
          <StockBadge locale={locale} inStock={part.inStock} isLocal={part.isLocal} className="mt-1" />
        </div>
      </div>
    </Link>
  );
}

/** Piesa fără poză: logo estompat, nu o poză de categorie care ar putea înșela. */
export function PartPlaceholder({ locale }: { locale: CatalogLocale }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-(--c-surface-2)">
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/logo.png"
          alt=""
          width={72}
          height={48}
          className="h-9 w-auto opacity-[0.18] grayscale"
        />
        <span className="text-xs text-(--c-faint)">{catalogCopy(locale).common.noPhoto}</span>
      </div>
    </div>
  );
}

/**
 * Disponibilitatea ca text simplu: verde dacă e pe stoc, gri dacă se aduce
 * la comandă. Piesele fabricate local o spun în aceeași propoziție.
 */
export function StockBadge({
  locale,
  inStock,
  isLocal = false,
  size = "sm",
  className = "",
}: {
  locale: CatalogLocale;
  inStock: boolean;
  isLocal?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const copy = catalogCopy(locale).common;
  return (
    <p className={`${size === "md" ? "text-[15px]" : "text-[13px]"} ${className}`}>
      <span className={inStock ? "font-medium text-(--c-green)" : "text-(--c-muted)"}>
        {inStock ? copy.inStock : copy.outOfStock}
      </span>
      {isLocal ? <span className="text-(--c-muted)">, {copy.local.toLowerCase()}</span> : null}
    </p>
  );
}
