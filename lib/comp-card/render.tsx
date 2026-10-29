import "server-only";
import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { compCardPhotos, coverOf, type ModelMedia, type ModelProfile } from "@/lib/data/model";
import type { Locale } from "@/lib/i18n/config";
import type { ModelDictionary } from "@/lib/i18n/model";
import { href } from "@/lib/i18n/paths";
import { COMP_CARD_TEMPLATE_VERSION, CompCardDocument, type CompCardData, type CompCardPhoto } from "./document";
import { measurementRows } from "./format";

/**
 * Фото тянем через оптимизатор Next (/_next/image): он ужимает оригинал до ширины печати A5
 * и без image/webp в Accept отдаёт JPEG, который понимает react-pdf. Битое фото пропускаем, а не роняем PDF.
 */
async function loadPhoto(origin: string, photo: ModelMedia, width: number): Promise<CompCardPhoto | null> {
  const url = `${origin}/_next/image?url=${encodeURIComponent(photo.src)}&w=${width}&q=82`;
  try {
    const res = await fetch(url, { headers: { Accept: "image/jpeg,image/png" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("jpeg") && !type.includes("png")) throw new Error(`unsupported ${type}`);
    return { data: Buffer.from(await res.arrayBuffer()), format: type.includes("png") ? "png" : "jpg" };
  } catch (e) {
    console.error("comp-card photo", photo.src, (e as Error).message);
    return null;
  }
}

/** Хэш входных данных: тот же data_hash, что пойдёт в таблицу comp_cards, и ETag ответа. */
export function compCardHash(model: ModelProfile, locale: Locale): string {
  const cover = coverOf(model);
  const payload = {
    v: COMP_CARD_TEMPLATE_VERSION,
    locale,
    name: model.name,
    category: model.category,
    newFace: model.isNewFace,
    m: model.measurements,
    photos: [cover, ...compCardPhotos(model)].map((p) => p?.src ?? null),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}

export async function renderCompCard({
  model,
  locale,
  t,
  origin,
  siteUrl,
}: {
  model: ModelProfile;
  locale: Locale;
  t: ModelDictionary;
  origin: string;
  siteUrl: string;
}): Promise<Buffer> {
  const cover = coverOf(model);
  const [coverImg, ...photos] = await Promise.all([
    cover ? loadPhoto(origin, cover, 1200) : Promise.resolve(null),
    ...compCardPhotos(model).map((p) => loadPhoto(origin, p, 828)),
  ]);

  const data: CompCardData = {
    name: model.name,
    label: [t.categories[model.category], model.isNewFace ? t.newFace : null].filter(Boolean).join(" · "),
    rows: measurementRows(model.measurements, t),
    cover: coverImg,
    photos: photos.filter((p): p is CompCardPhoto => p !== null),
    url: `${siteUrl.replace(/^https?:\/\//, "")}${href(locale, `/models/${model.slug}`)}`,
    motherAgency: t.motherAgency,
  };

  return renderToBuffer(<CompCardDocument data={data} />);
}
