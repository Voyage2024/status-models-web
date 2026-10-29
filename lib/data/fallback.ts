import type { OfficeCard, TalentCard } from "./types";

// Пока Supabase не подключён (или пуст), главная показывает модели и офисы из аудита старого сайта.
// Фото нет: карточка рисует монограмму-плейсхолдер.
const demoCover = (slug: string) =>
  process.env.NEXT_PUBLIC_DEMO_COVERS ? { src: `/demo/${slug}.jpg`, alt: "", width: 800, height: 1067 } : null;

const talent: Array<Omit<TalentCard, "cover" | "heightCm">> = [
  { slug: "kira-raab", name: "Kira Raab", category: "women", isNewFace: false },
  { slug: "celine-farah", name: "Celine Farah", category: "women", isNewFace: false },
  { slug: "marina-gerasimova", name: "Marina Gerasimova", category: "women", isNewFace: false },
  { slug: "kashish-kushal", name: "Kashish Kushal", category: "women", isNewFace: false },
  { slug: "anastasiia-prokhorova", name: "Anastasiia Prokhorova", category: "women", isNewFace: false },
  { slug: "ekaterina-tronova", name: "Ekaterina Tronova", category: "women", isNewFace: false },
];

export const fallbackTalent: TalentCard[] = talent.map((t) => ({ ...t, heightCm: null, cover: demoCover(t.slug) }));

export const fallbackOffices: OfficeCard[] = [
  { slug: "paris", city: "Paris", country: "France", name: "Paris" },
  { slug: "milan", city: "Milan", country: "Italy", name: "Milan" },
  { slug: "new-york", city: "New York", country: "United States", name: "New York" },
  { slug: "dubai", city: "Dubai", country: "United Arab Emirates", name: "Dubai" },
  { slug: "tokyo", city: "Tokyo", country: "Japan", name: "Tokyo" },
  { slug: "sydney", city: "Sydney", country: "Australia", name: "Sydney" },
];
