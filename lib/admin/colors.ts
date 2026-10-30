import type { Locale } from "@/lib/i18n/config";

type Color = { en: string; ru: string };

const HAIR_COLORS: readonly Color[] = [
  { en: "Black", ru: "Чёрные" },
  { en: "Dark brown", ru: "Тёмно-каштановые" },
  { en: "Brown", ru: "Каштановые" },
  { en: "Light brown", ru: "Светло-каштановые" },
  { en: "Auburn", ru: "Медно-каштановые" },
  { en: "Red", ru: "Рыжие" },
  { en: "Dark blonde", ru: "Тёмно-русые" },
  { en: "Blonde", ru: "Блонд" },
  { en: "Light blonde", ru: "Светлый блонд" },
  { en: "Grey", ru: "Серые" },
];

const EYE_COLORS: readonly Color[] = [
  { en: "Brown", ru: "Карие" },
  { en: "Dark brown", ru: "Тёмно-карие" },
  { en: "Hazel", ru: "Ореховые" },
  { en: "Green", ru: "Зелёные" },
  { en: "Grey-green", ru: "Серо-зелёные" },
  { en: "Blue", ru: "Голубые" },
  { en: "Grey-blue", ru: "Серо-голубые" },
  { en: "Blue-green", ru: "Сине-зелёные" },
  { en: "Grey", ru: "Серые" },
  { en: "Black", ru: "Чёрные" },
];

export type ColorOption = { value: string; label: string };

export function colorOptions(locale: Locale): { hair: ColorOption[]; eyes: ColorOption[] } {
  const build = (list: readonly Color[]): ColorOption[] =>
    list.map((c) => ({ value: c.en, label: locale === "ru" ? `${c.ru} · ${c.en}` : c.en }));
  return { hair: build(HAIR_COLORS), eyes: build(EYE_COLORS) };
}