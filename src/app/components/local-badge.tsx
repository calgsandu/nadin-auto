/** Indicator pentru piesele fabricate local (manufactura proprie). */
export function LocalBadge({
  className = "",
  locale = "ro",
}: {
  className?: string;
  locale?: "ro" | "ru";
}) {
  return (
    <span
      title={locale === "ru" ? "Местное производство Nadin Auto" : "Fabricat local — manufactura Nadin Auto"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-[#2e90fa]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1570d6] ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-2.5" aria-hidden>
        <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" strokeLinejoin="round" />
      </svg>
      {locale === "ru" ? "Местное" : "Local"}
    </span>
  );
}
