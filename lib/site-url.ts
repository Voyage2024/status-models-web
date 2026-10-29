const FALLBACK = "https://status-models.com";

/**
 * Адрес сайта из NEXT_PUBLIC_SITE_URL без слеша на конце.
 * Терпит значения вроде «status-models.com» или пустую строку: new URL() на них падает,
 * и сборка валится на prerender любой страницы.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return FALLBACK;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    return FALLBACK;
  }
}
