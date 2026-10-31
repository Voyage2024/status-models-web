import { notFound } from "next/navigation";
import { compCardHash, renderCompCard } from "@/lib/comp-card/render";
import { getModelProfile } from "@/lib/data/model";
import { isLocale } from "@/lib/i18n/config";
import { getModelDictionary } from "@/lib/i18n/model";
import { siteUrl } from "@/lib/site-url";

// react-pdf и node:crypto нужны Node.js, не Edge.
export const runtime = "nodejs";

/**
 * GET /{locale}/models/{slug}/comp-card → PDF A5, две страницы (лицо и оборот).
 * Собирается на лету; CDN Vercel держит его 5 минут, ETag по data_hash отдаёт 304 браузеру.
 */
export async function GET(req: Request, { params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [model, t] = await Promise.all([getModelProfile(slug, locale), getModelDictionary(locale)]);
  if (!model) notFound();

  const etag = `"${compCardHash(model, locale)}"`;
  const headers = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${slug}-comp-card-${locale}.pdf"`,
    "Cache-Control": "public, max-age=0, must-revalidate",
    // 5 минут, как ISR страницы: правка в админке доходит до PDF так же быстро.
    "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    ETag: etag,
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const origin = new URL(req.url).origin;
  const pdf = await renderCompCard({
    model,
    locale,
    t,
    origin,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() ? siteUrl() : origin,
  });
  return new Response(new Uint8Array(pdf), { headers });
}
