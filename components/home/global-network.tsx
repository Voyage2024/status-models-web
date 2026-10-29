import Link from "next/link";
import type { OfficeCard } from "@/lib/data/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";
import { SectionHeading } from "./section-heading";

export function GlobalNetwork({ locale, t, offices }: { locale: Locale; t: Dictionary["network"]; offices: OfficeCard[] }) {
  return (
    <section className="bg-graphite py-28 md:py-40" aria-labelledby="network-title">
      <div className="container-luxe">
        <SectionHeading id="network-title" index={t.index} title={t.title} lead={t.lead} />

        <ul className="mt-16 border-t border-line md:mt-24">
          {offices.map((o, i) => (
            <li key={o.slug} className="border-b border-line">
              <Link
                href={href(locale, `/offices/${o.slug}`)}
                className="group grid grid-cols-12 items-baseline gap-x-4 py-7 md:gap-x-8 md:py-9"
              >
                <span className="eyebrow col-span-2 text-mist tabular-nums md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
                <span className="display col-span-10 text-[clamp(2.4rem,6vw,5.5rem)] uppercase transition-[color,letter-spacing] duration-700 ease-luxe group-hover:tracking-[0.02em] group-hover:text-champagne md:col-span-6">
                  {o.name}
                </span>
                <span className="col-span-10 col-start-3 mt-2 font-display text-xl italic text-mist md:col-span-3 md:col-start-auto md:mt-0">
                  {t.cities[o.slug] ?? o.country}
                </span>
                <span className="eyebrow col-span-10 col-start-3 mt-3 flex items-center gap-3 text-mist transition-colors group-hover:text-bone md:col-span-2 md:col-start-auto md:mt-0 md:justify-self-end">
                  {t.explore}
                  <span className="h-px w-6 bg-current transition-[width] duration-500 ease-luxe group-hover:w-10" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
