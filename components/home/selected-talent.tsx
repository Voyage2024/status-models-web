import Link from "next/link";
import type { TalentCard } from "@/lib/data/types";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { href } from "@/lib/i18n/paths";
import { Portrait } from "./portrait";
import { SectionHeading } from "./section-heading";

// Редакционная сетка: ширина и сдвиг по вертикали чередуются, как в развороте журнала.
const layout = [
  "md:col-span-5",
  "md:col-span-3 md:col-start-7 md:mt-32",
  "md:col-span-3 md:col-start-10 md:mt-12",
  "md:col-span-3 md:col-start-2",
  "md:col-span-4 md:col-start-6 md:mt-24",
  "md:col-span-3 md:col-start-10 md:mt-8",
];

export function SelectedTalent({ locale, t, talent }: { locale: Locale; t: Dictionary["talent"]; talent: TalentCard[] }) {
  return (
    <section className="container-luxe py-28 md:py-40" aria-labelledby="talent-title">
      <SectionHeading id="talent-title" index={t.index} title={t.title} lead={t.lead} />

      {talent.length === 0 ? (
        <p className="mt-16 text-mist">{t.empty}</p>
      ) : (
        <ul className="mt-16 grid grid-cols-2 gap-x-4 gap-y-12 md:mt-24 md:grid-cols-12 md:gap-x-8 md:gap-y-24">
          {talent.map((m, i) => (
            <li key={m.slug} className={`col-span-1 ${layout[i % layout.length]}`}>
              <Link href={href(locale, `/models/${m.slug}`)} className="group block">
                <Portrait talent={m} sizes="(min-width: 768px) 33vw, 50vw" />
                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="display text-xl md:text-3xl">{m.name}</p>
                    {m.heightCm && (
                      <p className="eyebrow mt-2 text-mist">
                        {t.height} {Math.round(m.heightCm)}
                      </p>
                    )}
                  </div>
                  <span className="eyebrow pt-2 text-mist tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                </div>
                {m.isNewFace && <p className="eyebrow mt-2 text-champagne">{t.newFace}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-20 flex justify-center md:mt-28">
        <Link
          href={href(locale, "/models")}
          className="eyebrow group flex items-center gap-4 text-bone transition-colors hover:text-champagne"
        >
          {t.viewAll}
          <span className="h-px w-12 bg-current transition-[width] duration-500 ease-luxe group-hover:w-20" />
        </Link>
      </div>
    </section>
  );
}
