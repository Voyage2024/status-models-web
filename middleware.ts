import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { legacyGone, legacyRedirects } from "@/lib/seo/legacy-redirects";

function preferredLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;

  const header = req.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.lang))?.lang as Locale | undefined ?? defaultLocale;
}

function legacyKey(pathname: string): string {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // битый percent-encoding: сравниваем как есть
  }
  path = path.toLowerCase();
  return path.endsWith("/") ? path : `${path}/`;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Старые URL WordPress: 301 на новые адреса, 410 для мусора (карта из аудита URL).
  const key = legacyKey(pathname);
  const target = legacyRedirects[key];
  if (target) return NextResponse.redirect(new URL(target + search, req.url), 301);
  if (legacyGone.has(key)) return new NextResponse(null, { status: 410 });

  // 2. Канонический вид без слеша на конце.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return NextResponse.redirect(new URL(pathname.replace(/\/+$/, "") + search, req.url), 308);
  }

  // 3. Путь уже с языком: пропускаем, запоминая язык для следующего визита на корень.
  const first = pathname.split("/")[1];
  if (isLocale(first)) {
    const res = NextResponse.next();
    if (req.cookies.get(LOCALE_COOKIE)?.value !== first) {
      res.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return res;
  }

  // 4. Без языка: корень и прочие пути ведём на предпочтительный язык.
  // 307, а не 301: цель зависит от языка браузера, кэшировать её навсегда нельзя.
  const locale = preferredLocale(req);
  const url = new URL(`/${locale}${pathname === "/" ? "" : pathname}${search}`, req.url);
  return NextResponse.redirect(url, 307);
}

export const config = {
  // Всё, кроме API, служебных файлов Next.js и статики с расширением.
  matcher: ["/((?!api|_next|_vercel|favicon.ico|robots.txt|sitemap.xml|.*\\.[a-zA-Z0-9]+$).*)"],
};
