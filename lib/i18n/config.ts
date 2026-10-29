export const locales = ["en", "ru", "es", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  es: "Español",
  pt: "Português",
};

// hreflang и og:locale
export const localeRegions: Record<Locale, string> = {
  en: "en_US",
  ru: "ru_RU",
  es: "es_ES",
  pt: "pt_BR",
};

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export const LOCALE_COOKIE = "NEXT_LOCALE";
