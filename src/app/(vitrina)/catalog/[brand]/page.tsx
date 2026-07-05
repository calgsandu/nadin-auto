import Link from "next/link";
import { notFound } from "next/navigation";
import { getBrandData, getShowroomData } from "@/lib/vitrina/queries";
import { Reveal, StaggerGroup } from "../motion";

export const revalidate = 3600;

const numberFormat = new Intl.NumberFormat("ro-RO");

export async function generateStaticParams() {
  const { brands } = await getShowroomData();
  return brands.map((brand) => ({ brand: brand.slug }));
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand: brandSlug } = await params;
  const brand = await getBrandData(brandSlug);
  if (!brand || brand.models.length === 0) notFound();

  const total = brand.models.reduce((sum, model) => sum + model.productCount, 0);

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10">
        <p
          aria-hidden
          className="pointer-events-none absolute -bottom-8 left-0 select-none whitespace-nowrap text-[22vw] font-bold leading-none tracking-tighter text-white/[0.03]"
        >
          {brand.name}
        </p>
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-36 md:pb-24 md:pt-44">
          <Reveal>
            <p className="text-sm text-[#8f887c]">
              <Link href="/catalog" className="transition-colors hover:text-[#f4f1ea]">
                Catalog
              </Link>{" "}
              / {brand.name}
            </p>
            <h1 className="mt-4 text-5xl font-bold tracking-tight md:text-7xl">
              {brand.name}
            </h1>
            <p className="mt-4 text-base text-[#b5afa4] md:text-lg">
              {brand.models.length} modele · {numberFormat.format(total)} piese
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brand.models.map((model) => (
            <Link
              key={model.slug}
              href={`/catalog/${brand.slug}/${model.slug}`}
              data-stagger
              className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-[#d97706]/60 hover:bg-[#d97706]/5"
            >
              <div className="min-w-0">
                <p className="truncate text-xl font-semibold tracking-tight group-hover:text-[#d97706]">
                  {model.name}
                </p>
                <p className="mt-2 font-mono text-xs text-[#8f887c]">
                  {model.years ?? "toți anii"}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 font-mono text-xs text-[#b5afa4]">
                {numberFormat.format(model.productCount)}
              </span>
            </Link>
          ))}
        </StaggerGroup>
      </section>
    </>
  );
}
