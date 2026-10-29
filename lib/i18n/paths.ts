import { locales, type Locale } from "./config";

/** Ссылка внутри сайта с префиксом языка: href("ru", "/models") → "/ru/models". */
export function href(locale: Locale, path = "/"): string {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean}`;
}

/** Тот же путь на другом языке: slug моделей и офисов общий для всех языков. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const parts = pathname.split("/");
  if ((locales as readonly string[]).includes(parts[1] ?? "")) parts[1] = target;
  else parts.splice(1, 0, target);
  return parts.join("/") || `/${target}`;
}

/** alternates для generateMetadata: canonical + hreflang на все языки и x-default. */
export function alternates(locale: Locale, path = "/") {
  const languages: Record<string, string> = Object.fromEntries(locales.map((l) => [l, href(l, path)]));
  languages["x-default"] = href("en", path);
  return { canonical: href(locale, path), languages };
}
