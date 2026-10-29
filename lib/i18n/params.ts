import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";

/** Достаёт locale из params страницы; неизвестный язык → 404. */
export async function localeFrom(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
