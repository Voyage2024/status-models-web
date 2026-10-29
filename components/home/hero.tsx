import Link from "next/link";
import type { OfficeCard, TalentCard } from "@/lib/data/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";
import { Portrait } from "./portrait";

export function Hero({
  locale,
  t,
  feature,
  offices,
}: {
  locale: Locale;
  t: Dictionary["hero"];
  feature: TalentCard | undefined;
  offices: OfficeCard[];
}) {
  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden pt-24 md:pt-28" aria-labelledby="hero-title">
      {/* Мягкий тёплый свет из-за портрета */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[20vw] top-0 h-[90vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgba(200,169,106,0.10),transparent)]"
      />

      <div className="container-luxe relative grid flex-1 grid-cols-12 items-end gap-y-10 pb-12 md:gap-x-8">
        <div className="col-span-12 lg:col-span-7 lg:pb-6">
          <p className="eyebrow mb-8 flex items-center gap-4 text-mist">
            <span className="h-px w-10 bg-champagne" />
            {t.eyebrow}
          </p>
          <h1 id="hero-title" className="display uppercase">
            <span className="block text-[clamp(4.5rem,15vw,15rem)]">{t.titleTop}</span>
            <span className="block pl-[0.08em] text-[clamp(2.4rem,7.4vw,7.6rem)] italic normal-case text-champagne">
              {t.titleBottom}
            </span>
          </h1>
          <p className="mt-10 max-w-md text-[0.95rem] leading-relaxed text-mist">{t.lead}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href={href(locale, "/models")}
              className="eyebrow bg-bone px-8 py-4 text-ink transition-colors duration-300 hover:bg-champagne"
            >
              {t.ctaPrimary}
            </Link>
            <Link
              href={href(locale, "/become-a-model")}
              className="eyebrow border border-line px-8 py-4 text-bone transition-colors duration-300 hover:border-champagne hover:text-champagne"
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </div>

        {feature && (
          <Link
            href={href(locale, `/models/${feature.slug}`)}
            className="group col-span-12 sm:col-span-8 sm:col-start-3 lg:col-span-4 lg:col-start-9"
          >
            <Portrait talent={feature} sizes="(min-width: 1024px) 33vw, 80vw" priority />
            <div className="mt-4 flex items-baseline justify-between">
              <span className="display text-2xl">{feature.name}</span>
              <span className="eyebrow text-mist">N° 01</span>
            </div>
          </Link>
        )}
      </div>

      <div className="relative border-t border-line">
        <div className="container-luxe flex h-14 items-center justify-between gap-6">
          <ul className="eyebrow flex gap-6 overflow-hidden whitespace-nowrap text-mist md:gap-10">
            {offices.map((o) => (
              <li key={o.slug}>{o.name}</li>
            ))}
          </ul>
          <span className="eyebrow hidden items-center gap-3 text-mist sm:flex">
            {t.scroll}
            <span className="h-px w-8 bg-mist" />
          </span>
        </div>
      </div>
    </section>
  );
}
