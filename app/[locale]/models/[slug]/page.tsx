import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompCardButton } from "@/components/model/comp-card-button";
import { Measurements } from "@/components/model/measurements";
import { Portfolio } from "@/components/model/portfolio";
import { Portrait } from "@/components/home/portrait";
import { measurementRows, measurementSummary } from "@/lib/comp-card/format";
import { coverOf, getModelProfile, getPublishedModelSlugs } from "@/lib/data/model";
import { isLocale } from "@/lib/i18n/config";
import { getModelDictionary } from "@/lib/i18n/model";
import { alternates, href } from "@/lib/i18n/paths";
import { siteUrl } from "@/lib/site-url";

type Params = Promise<{ locale: string; slug: string }>;

// ISR: новые модели рендерятся по первому запросу, правки из админки видны через 5 минут.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getPublishedModelSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [model, t] = await Promise.all([getModelProfile(slug, locale), getModelDictionary(locale)]);
  if (!model) return {};

  const cover = coverOf(model);
  const description = model.seoDescription ?? t.metaDescription(model.name, measurementSummary(model.measurements, t));
  return {
    title: model.seoTitle ?? model.name,
    description,
    alternates: alternates(locale, `/models/${slug}`),
    openGraph: {
      type: "profile",
      title: model.name,
      description,
      images: cover ? [{ url: cover.src, width: cover.width ?? undefined, height: cover.height ?? undefined, alt: model.name }] : undefined,
    },
  };
}

export default async function ModelPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [model, t] = await Promise.all([getModelProfile(slug, locale), getModelDictionary(locale)]);
  if (!model) notFound();

  const cover = coverOf(model);
  const rows = measurementRows(model.measurements, t);
  const [first, ...rest] = model.name.split(" ");
  const site = siteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: model.name,
    url: `${site}${href(locale, `/models/${slug}`)}`,
    image: cover?.src,
    jobTitle: "Model",
    height: model.measurements?.heightCm ? { "@type": "QuantitativeValue", value: model.measurements.heightCm, unitCode: "CMT" } : undefined,
    affiliation: { "@type": "Organization", name: "STATUS INTERNATIONAL", url: site },
    sameAs: model.instagram ? [`https://www.instagram.com/${model.instagram.replace(/^@/, "")}/`] : undefined,
  };

  return (
    <main className="pt-28 md:pt-36">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="container-luxe">
        <Link href={href(locale, "/models")} className="eyebrow group inline-flex items-center gap-3 text-mist transition-colors hover:text-champagne">
          <span className="h-px w-8 bg-current transition-[width] duration-500 ease-luxe group-hover:w-12" />
          {t.back}
        </Link>
      </div>

      <section className="container-luxe mt-10 grid grid-cols-12 gap-y-12 md:mt-14 md:gap-x-8" aria-labelledby="model-name">
        <div className="col-span-12 md:col-span-6 lg:col-span-7">
          <Portrait
            talent={{ slug: model.slug, name: model.name, category: model.category, isNewFace: model.isNewFace, heightCm: null, cover }}
            sizes="(min-width: 1024px) 58vw, (min-width: 768px) 50vw, 100vw"
            priority
            className="[&_img]:grayscale-0"
          />
        </div>

        <div className="col-span-12 md:col-span-6 lg:col-span-5">
          <div className="md:sticky md:top-32">
            <p className="eyebrow flex items-center gap-4 text-mist">
              <span className="h-px w-10 bg-champagne" />
              {t.categories[model.category]}
              {model.isNewFace && <span className="text-champagne">· {t.newFace}</span>}
            </p>

            <h1 id="model-name" className="display mt-8 text-[clamp(3.5rem,8vw,8.5rem)] uppercase">
              {first}
              {rest.length > 0 && (
                <>
                  <br />
                  <span className="italic text-champagne">{rest.join(" ")}</span>
                </>
              )}
            </h1>

            <div className="mt-12">
              <Measurements rows={rows} title={t.measurements} />
            </div>

            {model.markets.length > 0 && (
              <div className="mt-10">
                <p className="eyebrow mb-4 text-champagne">{t.representedIn}</p>
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                  {model.markets.map((m) => (
                    <li key={m.slug}>
                      <Link href={href(locale, `/offices/${m.slug}`)} className="display text-2xl transition-colors hover:text-champagne">
                        {m.name}
                      </Link>
                      {m.kind === "mother_agency" && <span className="eyebrow ml-2 text-mist">{t.motherAgency}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {model.bio && <p className="mt-10 max-w-md text-sm leading-relaxed text-mist">{model.bio}</p>}

            <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-1 2xl:grid-cols-2">
              <CompCardButton locale={locale} slug={model.slug} label={t.compCard} hint={t.compCardHint} />
              <Link
                href={href(locale, `/contact?model=${encodeURIComponent(model.slug)}`)}
                className="eyebrow flex items-center justify-between gap-6 border border-line px-6 py-5 text-bone transition-colors duration-500 ease-luxe hover:border-bone"
              >
                {t.book}
                <span aria-hidden>→</span>
              </Link>
            </div>

            {model.instagram && (
              <a
                href={`https://www.instagram.com/${model.instagram.replace(/^@/, "")}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="eyebrow mt-8 inline-block text-mist transition-colors hover:text-champagne"
              >
                Instagram · @{model.instagram.replace(/^@/, "")}
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="container-luxe py-28 md:py-40" aria-label={t.portfolio}>
        <Portfolio media={model.media} t={t} />
      </section>
    </main>
  );
}
