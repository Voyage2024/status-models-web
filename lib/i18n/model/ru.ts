import type { ModelDictionary } from ".";

const ru: ModelDictionary = {
  back: "Все модели",
  newFace: "New face",
  measurements: "Параметры",
  height: "Рост",
  bust: "Грудь",
  waist: "Талия",
  hips: "Бёдра",
  shoes: "Обувь",
  hair: "Волосы",
  eyes: "Глаза",
  representedIn: "Рынки",
  motherAgency: "Материнское агентство",
  compCard: "Скачать Comp Card",
  compCardHint: "PDF · A5 · для печати",
  book: "Забронировать модель",
  portfolio: "Портфолио",
  digitals: "Диджиталы",
  editorial: "Editorial",
  campaign: "Кампании",
  noPhotos: "Портфолио обновляется.",
  metaDescription: (name, params) =>
    `${name} — модель материнского агентства STATUS INTERNATIONAL.${params ? ` ${params}.` : ""} Портфолио и Comp Card.`,
  categories: { women: "Женщины", men: "Мужчины", new_faces: "Новые лица", other: "Таланты" },
};

export default ru;
