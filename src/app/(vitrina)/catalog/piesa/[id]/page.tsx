import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductDetails } from "@/lib/vitrina/queries";
import { productImage, typeImage } from "@/lib/vitrina/images";
import { Reveal, StaggerGroup } from "../../motion";

export const revalidate = 3600;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductDetails(id);
  if (!product) notFound();

  const realImage = productImage(product.code);
  const image = realImage ?? typeImage(product.type);
  const modelHref = `/catalog/${product.brand.slug}/${product.model.slug}`;

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-32 md:pt-40">
        <Reveal>
          <p className="text-sm text-[#8f887c]">
            <Link href="/catalog" className="transition-colors hover:text-[#f4f1ea]">
              Catalog
            </Link>{" "}
            /{" "}
            <Link
              href={`/catalog/${product.brand.slug}`}
              className="transition-colors hover:text-[#f4f1ea]"
            >
              {product.brand.name}
            </Link>{" "}
            /{" "}
            <Link href={modelHref} className="transition-colors hover:text-[#f4f1ea]">
              {product.model.name}
            </Link>{" "}
            / <span className="font-mono">{product.code ?? "piesă"}</span>
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <Reveal className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <Image
                src={image}
                alt={product.description}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
              {!realImage ? (
                <span className="absolute bottom-3 left-3 rounded-full bg-[#0b0a08]/80 px-3 py-1.5 text-[11px] text-[#b5afa4] backdrop-blur">
                  Imagine de referință a categoriei
                </span>
              ) : null}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#b5afa4]">
                {product.type}
              </span>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  product.inStock
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-white/5 text-[#8f887c]"
                }`}
              >
                {product.inStock ? "În stoc" : "La comandă"}
              </span>
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-[1.08] tracking-tight md:text-5xl">
              {product.description}
            </h1>
            <p className="mt-4 font-mono text-lg text-[#d97706]">
              {product.code ?? "—"}
            </p>

            <dl className="mt-8 space-y-4 border-t border-white/10 pt-8 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-[#8f887c]">Mașina</dt>
                <dd className="text-right font-medium">
                  {product.brand.name} {product.model.name}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[#8f887c]">Ani de fabricație</dt>
                <dd className="text-right font-medium">
                  {product.years ?? "toți anii"}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-[#8f887c]">Compatibilitate</dt>
                <dd className="text-right font-mono text-xs">{product.fitLabel}</dd>
              </div>
              {product.notes ? (
                <div className="flex justify-between gap-6">
                  <dt className="text-[#8f887c]">Note</dt>
                  <dd className="text-right">{product.notes}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href={modelHref}
                className="rounded-full bg-[#d97706] px-6 py-3 text-sm font-semibold text-[#0b0a08] transition-colors hover:bg-[#f59e0b]"
              >
                Toate piesele pentru {product.model.name}
              </Link>
              <Link
                href="/catalog/cauta"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/5"
              >
                Caută altă piesă
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {product.related.length > 0 ? (
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-8 md:pb-32">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Alte piese pentru {product.brand.name} {product.model.name}
            </h2>
          </Reveal>
          <StaggerGroup className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {product.related.map((entry) => (
              <Link
                key={entry.id}
                href={`/catalog/piesa/${entry.id}`}
                data-stagger
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-[#d97706]/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-mono text-xs text-[#d97706]">
                    {entry.code ?? "—"}
                  </p>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#b5afa4]">
                    {entry.type}
                  </span>
                </div>
                <p className="mt-3 text-base font-medium leading-snug group-hover:text-[#d97706]">
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
