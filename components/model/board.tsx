"use client";

import Link from "next/link";
import { useState } from "react";
import { Portrait } from "@/components/home/portrait";
import type { TalentCard } from "@/lib/data/types";
import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/paths";

type Labels = { all: string; height: string; newFace: string; categories: Record<TalentCard["category"], string> };

/** Сетка борда 4 в ряд с фильтром по категории. Фильтр на клиенте, чтобы страница оставалась статичной (ISR). */
export function Board({ locale, talent, t }: { locale: Locale; talent: TalentCard[]; t: Labels }) {
  const categories = [...new Set(talent.map((m) => m.category))];
  const [active, setActive] = useState<TalentCard["category"] | "all">("all");
  const shown = active === "all" ? talent : talent.filter((m) => m.category === active);

  return (
    <>
      {categories.length > 1 && (
        <div className="mb-12 flex flex-wrap gap-x-8 gap-y-3 border-b border-line pb-5" role="tablist">
          {(["all", ...categories] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={active === c}
              onClick={() => setActive(c)}
              className={`eyebrow transition-colors ${active === c ? "text-champagne" : "text-mist hover:text-bone"}`}
            >
              {c === "all" ? t.all : t.categories[c]}
            </button>
          ))}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 md:gap-x-6 md:gap-y-16 lg:grid-cols-4 lg:gap-x-8">
        {shown.map((m, i) => (
          <li key={m.slug}>
            <Link href={href(locale, `/models/${m.slug}`)} className="group block">
              <Portrait talent={m} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" priority={i < 4} />
              <div className="mt-4 flex items-start justify-between gap-3">
                <p className="display text-xl transition-colors group-hover:text-champagne md:text-2xl">{m.name}</p>
                <span className="eyebrow pt-1.5 tabular-nums text-mist">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <p className="eyebrow mt-2 text-mist">
                {m.heightCm ? `${t.height} ${Math.round(m.heightCm)}` : null}
                {m.isNewFace && <span className="text-champagne">{m.heightCm ? " · " : ""}{t.newFace}</span>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
