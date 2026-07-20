import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductDetails } from "@/lib/vitrina/queries";
import { productImage, typeImage } from "@/lib/vitrina/images";
import { LocalBadge } from "@/app/components/local-badge";
import { Reveal, StaggerGroup } from "../../motion";
import type { Metadata } from "next";
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, locale] = await Promise.all([params, getRequestCatalogLocale()]);
  const product = await getProductDetails(id, locale);
  if (!product) return {};
  const suffix = `/piesa/${id}`;
  return {
    title: `${product.description} — Nadin Auto`,
    description: `${product.brand.name} ${product.model.name} · ${product.fitLabel} · ${product.code ?? product.type}`,
    alternates: {
      canonical: catalogHref(locale, suffix),
      languages: { ro: catalogHref("ro", suffix), ru: catalogHref("ru", suffix) },
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, locale] = await Promise.all([params, getRequestCatalogLocale()]);
  const copy = catalogCopy(locale);
  const product = await getProductDetails(id, locale);
  if (!product) notFound();

  const realImage = productImage(product.code);
  const image = realImage ?? typeImage(product.typeSource);
  const modelHref = catalogHref(locale, `/${product.brand.slug}/${product.model.slug}`);

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-32 md:pt-40">
        <Reveal>
          <p className="text-sm text-[#6f6a61]">
            <Link href={catalogHref(locale)} className="transition-colors hover:text-[#1b1a17]">
              {copy.common.catalog}
            </Link>{" "}
            /{" "}
            <Link
              href={catalogHref(locale, `/${product.brand.slug}`)}
              className="transition-colors hover:text-[#1b1a17]"
            >
              {product.brand.name}
            </Link>{" "}
            /{" "}
            <Link href={modelHref} className="transition-colors hover:text-[#1b1a17]">
              {product.model.name}
            </Link>{" "}
            / <span className="font-mono">{product.code ?? (locale === "ru" ? "деталь" : "piesă")}</span>
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <Reveal className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-black/10 bg-white">
              <Image
                src={image}
                alt={product.description}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
              {!realImage ? (
                <span className="absolute bottom-3 left-3 rounded-full bg-white/85 px-3 py-1.5 text-[11px] text-[#57534a] backdrop-blur">
                  {locale === "ru" ? "Изображение категории" : "Imagine de referință a categoriei"}
                </span>
              ) : null}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-[#57534a]">
                {product.type}
              </span>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  product.inStock
                    ? "bg-emerald-600/10 text-emerald-700"
                    : "bg-black/5 text-[#6f6a61]"
                }`}
              >
                {product.inStock ? copy.common.inStock : copy.common.outOfStock}
              </span>
              {product.isLocal ? <LocalBadge locale={locale} className="!text-[11px] px-3 py-1.5" /> : null}
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-[1.08] tracking-tight md:text-5xl">
              {product.description}
            </h1>
            <p className="mt-4 font-mono text-lg text-[#2e90fa]">
              {product.code ?? "—"}
            </p>

            <dl className="mt-8 space-y-4 border-t border-black/10 pt-8 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-[#6f6a61]">{locale === "ru" ? "Автомобиль" : "Mașina"}</dt>
                <dd className="text-right font-medium">
                  {product.brand.name} {product.model.name}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[#6f6a61]">{locale === "ru" ? "Годы выпуска" : "Ani de fabricație"}</dt>
                <dd className="text-right font-medium">
                  {product.years ?? copy.common.allYears}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[#6f6a61]">{copy.product.compatibility}</dt>
                <dd className="text-right font-mono text-xs">{product.fitLabel}</dd>
              </div>
              {product.notes ? (
                <div className="flex justify-between gap-6">
                  <dt className="text-[#6f6a61]">{copy.product.notes}</dt>
                  <dd className="text-right">{product.notes}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href={modelHref}
                className="rounded-full bg-[#2e90fa] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1b7fe8]"
              >
                {locale === "ru" ? `Все детали для ${product.model.name}` : `Toate piesele pentru ${product.model.name}`}
              </Link>
              <Link
                href={catalogHref(locale, "/cauta")}
                className="rounded-full border border-black/15 px-6 py-3 text-sm font-semibold transition-colors hover:bg-black/5"
              >
                {locale === "ru" ? "Найти другую деталь" : "Caută altă piesă"}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {product.related.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-8 md:pb-32">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {locale === "ru" ? "Другие детали для" : "Alte piese pentru"} {product.brand.name} {product.model.name}
            </h2>
          </Reveal>
          <StaggerGroup className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {product.related.map((entry) => (
              <Link
                key={entry.id}
                href={catalogHref(locale, `/piesa/${entry.id}`)}
                data-stagger
                className="group rounded-2xl border border-black/10 bg-white p-5 transition-colors hover:border-[#2e90fa]/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-xs text-[#2e90fa]">
                    {entry.code ?? "—"}
                  </p>
                  <span className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-[#57534a]">
                    {entry.type}
                  </span>
                </div>
                <p className="mt-3 text-base font-medium leading-snug group-hover:text-[#2e90fa]">
                  {entry.description}
                </p>
              </Link>
            ))}
          </StaggerGroup>
        </section>
      ) : null}
    </>
  );
}
