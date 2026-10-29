import type { ModelProfile } from "./model";
import { fallbackTalent } from "./fallback";

// Параметры перенесены со старых страниц status-models.com (/kira_raab/ и т. д.) на 2026-10-28.
// Нужны, пока Supabase не подключён; после импорта моделей в базу файл не используется.
const legacy: Record<string, ModelProfile["measurements"]> = {
  "kira-raab": m(165, 72, 60, 82, "Dark brown", "Grey-blue"),
  "celine-farah": m(162, 80, 62, 90, "Dark brown", "Brown"),
  "marina-gerasimova": m(167, 82, 58, 92, "Long red", "Blue"),
  "kashish-kushal": m(150, 84, 60, 90, "Dark brown", "Brown"),
  "anastasiia-prokhorova": m(164, 82, 60, 88, "Light brown", "Brown"),
  "ekaterina-tronova": m(173, 95, 63, 95, "Light brown", "Grey"),
};

function m(heightCm: number, bustCm: number, waistCm: number, hipsCm: number, hairColor: string, eyeColor: string) {
  return { heightCm, bustCm, waistCm, hipsCm, shoeEu: null, hairColor, eyeColor };
}

const demoPortfolio: Array<[number, number, number]> = [
  [1, 800, 1067],
  [2, 800, 1200],
  [3, 1200, 800],
  [4, 800, 1067],
  [5, 800, 1000],
  [6, 800, 1200],
];

export function fallbackProfile(slug: string): ModelProfile | null {
  const t = fallbackTalent.find((x) => x.slug === slug);
  if (!t) return null;
  const media: ModelProfile["media"] = t.cover
    ? [{ id: `${slug}-cover`, kind: "cover", ...t.cover, credits: null, inCompCard: true }]
    : [];
  // Демо-режим превью (NEXT_PUBLIC_DEMO_COVERS): плейсхолдеры портфолио из public/demo, в продакшене не включается.
  if (t.cover) {
    for (const [i, w, h] of demoPortfolio) {
      media.push({ id: `${slug}-${i}`, kind: "portfolio", src: `/demo/${slug}-${i}.jpg`, alt: t.name, width: w, height: h, credits: null, inCompCard: i <= 4 });
    }
  }
  return {
    id: slug,
    slug,
    name: t.name,
    category: t.category,
    isNewFace: t.isNewFace,
    instagram: null,
    bio: null,
    seoTitle: null,
    seoDescription: null,
    measurements: legacy[slug] ?? null,
    media,
    markets: [],
    updatedAt: "2026-10-28T00:00:00Z",
  };
}

export const fallbackSlugs = fallbackTalent.map((t) => t.slug);
