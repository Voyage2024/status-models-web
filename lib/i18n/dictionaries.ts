import "server-only";
import type { Locale } from "./config";
import en from "./dictionaries/en";

export type Dictionary = typeof en;

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: async () => en,
  ru: () => import("./dictionaries/ru").then((m) => m.default),
  es: () => import("./dictionaries/es").then((m) => m.default),
  pt: () => import("./dictionaries/pt").then((m) => m.default),
};

export const getDictionary = (locale: Locale) => loaders[locale]();
