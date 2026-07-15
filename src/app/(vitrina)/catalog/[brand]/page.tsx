import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getBrandData, getShowroomData } from "@/lib/vitrina/queries";
import { brandLogo, modelImage } from "@/lib/vitrina/images";
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
  const logo = brandLogo(brand.slug);

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
            <div className="mt-4 flex items-center gap-5">
              {logo ? (
                <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-white/95 p-3 md:size-24">
                  <Image
                    src={logo}
                    alt={brand.name}
                    width={96}
                    height={96}
                    className="h-14 w-full object-contain md:h-18"
                  />
                </span>
              ) : null}
              <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
                {brand.name}
              </h1>
            </div>
            <p className="mt-4 text-base text-[#b5afa4] md:text-lg">
              {brand.models.length} modele · {numberFormat.format(total)} piese
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brand.models.map((model) => {
            const photo = modelImage(brand.slug, model.slug);
            return (
              <Link
                key={model.slug}
                href={`/catalog/${brand.slug}/${model.slug}`}
                data-stagger
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition-colors hover:border-[#d97706]/60"
              >
                {photo ? (
                  <div className="relative aspect-[4/3] overflow-hidden bg-white">
                    <Image
                      src={photo}
                      alt={`${brand.name} ${model.name}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 p-6">
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
                </div>
              </Link>
            );
          })}
        </StaggerGroup>
      </section>
    </>
  );
}
