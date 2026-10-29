import "server-only";
import type { Locale } from "../config";
import en from "./en";

// Строки страницы модели и Comp Card. Отдельно от общих словарей, чтобы не пересекаться с формой скаутинга.
export type ModelDictionary = typeof en;

const loaders: Record<Locale, () => Promise<ModelDictionary>> = {
  en: async () => en,
  ru: () => import("./ru").then((m) => m.default),
  es: () => import("./es").then((m) => m.default),
  pt: () => import("./pt").then((m) => m.default),
};

export const getModelDictionary = (locale: Locale) => loaders[locale]();
