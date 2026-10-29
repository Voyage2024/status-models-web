import type { ModelMedia } from "@/lib/data/model";
import type { ModelDictionary } from "@/lib/i18n/model";
import { ModelPhoto } from "./model-photo";

const order = ["portfolio", "editorial", "campaign", "digitals"] as const;

/** Портфолио блоками по типу съёмки; каждый блок — колонки разной высоты, как журнальная раскладка. */
export function Portfolio({ media, t }: { media: ModelMedia[]; t: ModelDictionary }) {
  const groups = order
    .map((kind) => ({ kind, items: media.filter((m) => m.kind === kind) }))
    .filter((g) => g.items.length);

  if (!groups.length) return <p className="text-mist">{t.noPhotos}</p>;

  return (
    <div className="space-y-24 md:space-y-32">
      {groups.length > 1 && (
        <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label={t.portfolio}>
          {groups.map((g) => (
            <a key={g.kind} href={`#${g.kind}`} className="eyebrow text-mist transition-colors hover:text-champagne">
              {t[g.kind]} <span className="tabular-nums">({g.items.length})</span>
            </a>
          ))}
        </nav>
      )}
      {groups.map((g, gi) => (
        <section key={g.kind} id={g.kind} aria-labelledby={`${g.kind}-title`} className="scroll-mt-32">
          <div className="mb-10 flex items-baseline justify-between border-b border-line pb-5">
            <h2 id={`${g.kind}-title`} className="display text-4xl uppercase md:text-6xl">
              {t[g.kind]}
            </h2>
            <span className="eyebrow tabular-nums text-mist">{String(gi + 1).padStart(2, "0")}</span>
          </div>
          <ul className={g.kind === "digitals" ? "grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6" : "columns-2 gap-4 md:columns-3 md:gap-8"}>
            {g.items.map((photo, i) => (
              <li key={photo.id} className="mb-4 break-inside-avoid md:mb-8">
                <ModelPhoto photo={photo} sizes="(min-width: 768px) 33vw, 50vw" priority={gi === 0 && i < 3} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
