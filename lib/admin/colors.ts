import type { Locale } from "@/lib/i18n/config";
import en from "@/lib/i18n/model/en";
import ru from "@/lib/i18n/model/ru";

/**
 * Варианты цвета волос/глаз для формы параметров. В базу пишется английское название
 * (как в сиде: «Light brown»), сайт переводит его словарями hairColors/eyeColors из lib/i18n/model.
 */
export function colorOptions(locale: Locale) {
  const build = (base: Record<string, string>, local: Record<string, string>) =>
    Object.entries(base).map(([key, value]) => ({
      value,
      label: locale === "ru" && local[key] ? `${local[key]} · ${value}` : value,
    }));
  return { hair: build(en.hairColors, ru.hairColors), eyes: build(en.eyeColors, ru.eyeColors) };
}
