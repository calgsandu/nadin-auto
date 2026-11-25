import Link from "next/link";
import Image from "next/image";
import { productImage } from "@/lib/vitrina/images";
import { LocalBadge } from "@/app/components/local-badge";
import { catalogCopy, catalogHref, type CatalogLocale } from "@/lib/vitrina/i18n";

/**
 * Cardul unei piese din vitrină (model, căutare, „alte piese”). Toate cardurile
 * au aceeași formă — zonă de imagine fixă, apoi cod, denumire, compatibilitate —
 * ca grila să stea dreaptă și când doar unele piese au poză.
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
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-colors hover:border-[#2e90fa]/60"
    >
      <div
        className={`relative aspect-[4/3] overflow-hidden border-b border-black/5 ${
          image ? "bg-white" : "bg-[#f1f0ec]"
        }`}
      >
        {image ? (
          <Image
            src={image}
            alt={part.description}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-3 transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <PartPlaceholder locale={locale} />
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-mono text-xs font-semibold text-[#2e90fa]">
            {part.code ?? "—"}
          </p>
          {part.isLocal ? <LocalBadge locale={locale} /> : null}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-[#1b1a17] group-hover:text-[#2e90fa] sm:text-[15px]">
          {part.description}
        </p>
        <div className="mt-auto pt-2">
          {subtitle ? (
            <p className="line-clamp-1 text-xs text-[#6f6a61] sm:text-[13px]">{subtitle}</p>
          ) : null}
          <StockBadge locale={locale} inStock={part.inStock} className="mt-1.5" />
        </div>
      </div>
    </Link>
  );
}

/** Piesa fără poză: logo estompat, nu o poză de categorie care ar putea înșela. */
export function PartPlaceholder({ locale }: { locale: CatalogLocale }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_45%,#ffffff,#efeee9_70%)]">
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/logo.png"
          alt=""
          width={72}
          height={48}
          className="h-9 w-auto opacity-[0.18] grayscale"
        />
        <span className="text-[11px] text-[#a19c92]">
          {catalogCopy(locale).common.noPhoto}
        </span>
      </div>
    </div>
  );
}

/** Disponibilitatea ca text simplu cu un punct colorat, fără chenar sau fundal. */
export function StockBadge({
  locale,
  inStock,
  size = "sm",
  className = "",
}: {
  locale: CatalogLocale;
  inStock: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const copy = catalogCopy(locale).common;
  return (
    <span
      className={`flex items-center gap-1.5 font-semibold ${
        size === "md" ? "text-sm" : "text-xs"
      } ${inStock ? "text-emerald-700" : "text-[#6f6a61]"} ${className}`}
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${inStock ? "bg-emerald-500" : "bg-[#b4afa5]"}`}
      />
      {inStock ? copy.inStock : copy.outOfStock}
    </span>
  );
}
