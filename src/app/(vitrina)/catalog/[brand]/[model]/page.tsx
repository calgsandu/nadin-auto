import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getModelData } from "@/lib/vitrina/queries";
import { productImage, modelImage } from "@/lib/vitrina/images";
import { Reveal, StaggerGroup } from "../../motion";

export const revalidate = 3600;

const numberFormat = new Intl.NumberFormat("ro-RO");

export default async function ModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string; model: string }>;
  searchParams: Promise<{ tip?: string }>;
}) {
  const [{ brand: brandSlug, model: modelSlug }, { tip }] = await Promise.all([
    params,
    searchParams,
  ]);
  const data = await getModelData(brandSlug, modelSlug);
  if (!data) notFound();

  const total = data.groups.reduce((sum, group) => sum + group.products.length, 0);
  const activeGroups = tip
    ? data.groups.filter((group) => group.slug === tip)
    : data.groups;
  const photo = modelImage(data.brand.slug, data.model.slug);

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <p
          aria-hidden
          className="pointer-events-none absolute -bottom-8 left-0 select-none whitespace-nowrap text-[20vw] font-bold leading-none tracking-tighter text-white/[0.03]"
        >
          {data.model.name}
        </p>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-36 md:grid-cols-[1.1fr_1fr] md:pb-20 md:pt-44">
          <Reveal>
            <p className="text-sm text-[#8f887c]">
              <Link href="/catalog" className="transition-colors hover:text-[#f4f1ea]">
                Catalog
              </Link>{" "}
              /{" "}
              <Link
                href={`/catalog/${data.brand.slug}`}
                className="transition-colors hover:text-[#f4f1ea]"
              >
                {data.brand.name}
              </Link>{" "}
              / {data.model.name}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
              {data.brand.name}{" "}
              <span className="text-[#d97706]">{data.model.name}</span>
            </h1>
            <p className="mt-4 text-base text-[#b5afa4]">
              {data.model.years ?? "toți anii"} · {numberFormat.format(total)} piese
            </p>
          </Reveal>
          {photo ? (
            <Reveal delay={0.1}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-white">
                <Image
                  src={photo}
                  alt={`${data.brand.name} ${data.model.name}`}
                  fill
                  priority
                  sizes="(min-width: 768px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/catalog/${data.brand.slug}/${data.model.slug}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !tip
                ? "bg-[#f4f1ea] text-[#0b0a08]"
                : "border border-white/10 text-[#b5afa4] hover:text-[#f4f1ea]"
            }`}
          >
            Toate
          </Link>
          {data.groups.map((group) => (
            <Link
              key={group.slug}
              href={`/catalog/${data.brand.slug}/${data.model.slug}?tip=${group.slug}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tip === group.slug
                  ? "bg-[#f4f1ea] text-[#0b0a08]"
                  : "border border-white/10 text-[#b5afa4] hover:text-[#f4f1ea]"
              }`}
            >
              {group.type}
              <span className="ml-2 font-mono text-xs opacity-60">
                {group.products.length}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-12 space-y-16">
          {activeGroups.map((group) => (
            <div key={group.slug}>
              <Reveal>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {group.type}
                  <span className="ml-3 font-mono text-sm font-normal text-[#8f887c]">
                    {group.products.length}
                  </span>
                </h2>
              </Reveal>
              <StaggerGroup className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.products.map((product) => {
                  const image = productImage(product.code);
                  return (
                    <Link
                      key={product.id}
                      href={`/catalog/piesa/${product.id}`}
                      data-stagger
                      className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-[#d97706]/60"
                    >
                      {image ? (
                        <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
                          <Image
                            src={image}
                            alt={product.description}
                            fill
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          />
                        </div>
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-mono text-xs text-[#d97706]">
                          {product.code ?? "—"}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            product.inStock
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-white/5 text-[#8f887c]"
                          }`}
                        >
                          {product.inStock ? "În stoc" : "La comandă"}
                        </span>
                      </div>
                      <p className="mt-3 text-base font-medium leading-snug group-hover:text-[#d97706]">
                        {product.description}
                      </p>
                      <p className="mt-2 font-mono text-xs text-[#8f887c]">
                        {product.fitLabel}
                      </p>
                    </Link>
                  );
                })}
              </StaggerGroup>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
