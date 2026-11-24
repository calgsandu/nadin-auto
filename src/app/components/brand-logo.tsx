import { brandLogo } from "@/lib/vitrina/images";
import { slugify } from "@/lib/vitrina/slug";

/**
 * Logo-ul mărcii auto, mic, pentru liste și tabele (`public/branduri/mici`,
 * 96px — originalele au ~90 KB bucata). Marca fără logo își arată inițiala.
 * Citește discul, deci merge doar în componente de server.
 */
export function brandLogoSrc(name: string) {
  return brandLogo(slugify(name))?.replace("/branduri/", "/branduri/mici/") ?? null;
}

export function BrandLogo({ name, className = "size-6" }: { name: string; className?: string }) {
  const src = brandLogoSrc(name);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className={`${className} shrink-0 object-contain dark:rounded-sm dark:bg-white dark:p-px`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center rounded-md bg-(--c-hover) text-[0.6875rem] font-semibold text-(--c-muted-2)`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** „MERCEDES-BENZ" → „Mercedes-Benz": majusculele pe 30 de rânduri strigă. Siglele scurte rămân (BMW, KIA). */
export function brandLabel(name: string) {
  if (name.length <= 3) return name;
  return name
    .toLocaleLowerCase("ro")
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase("ro"));
}

/** Logo + numele mărcii, pe un rând. */
export function BrandName({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandLogo name={name} />
      {brandLabel(name)}
    </span>
  );
}
