import "server-only";
import { cache } from "react";
import { hasSupabase } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { createPublicClient } from "@/lib/supabase/public";
import { fallbackProfile, fallbackSlugs } from "./model-fallback";
import type { TalentCard } from "./types";

export type MediaKind = "cover" | "portfolio" | "digitals" | "editorial" | "campaign";

export type ModelMedia = {
  id: string;
  kind: MediaKind;
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  credits: string | null;
  inCompCard: boolean;
};

export type ModelMeasurements = {
  heightCm: number | null;
  bustCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  shoeEu: number | null;
  hairColor: string | null;
  eyeColor: string | null;
};

export type ModelProfile = {
  id: string;
  slug: string;
  name: string;
  category: TalentCard["category"];
  isNewFace: boolean;
  instagram: string | null;
  bio: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  measurements: ModelMeasurements | null;
  media: ModelMedia[];
  markets: Array<{ slug: string; name: string; kind: string }>;
  updatedAt: string;
};

type Row = {
  id: string;
  slug: string;
  first_name: string;
  last_name: string | null;
  category: ModelProfile["category"];
  is_new_face: boolean;
  instagram: string | null;
  updated_at: string;
  model_translations: Array<{
    locale: string;
    display_name: string;
    bio: string | null;
    seo_title: string | null;
    seo_description: string | null;
    is_reviewed: boolean;
  }> | null;
  model_media: Array<{
    id: string;
    kind: MediaKind | "video";
    bucket: string;
    storage_path: string;
    alt: string | null;
    width: number | null;
    height: number | null;
    credits: string | null;
    sort_order: number;
    in_comp_card: boolean;
  }> | null;
  model_representations: Array<{
    kind: string;
    offices: { slug: string; city: string; office_translations: Array<{ locale: string; name: string }> | null } | null;
  }> | null;
};

const num = (v: unknown) => (v == null ? null : Number(v));

/**
 * Опубликованная модель по slug. Обёрнуто в cache(), чтобы generateMetadata, страница и PDF
 * в одном запросе ходили в базу один раз. null → 404.
 */
export const getModelProfile = cache(async (slug: string, locale: Locale): Promise<ModelProfile | null> => {
  if (!hasSupabase()) return fallbackProfile(slug, locale);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("models")
    .select(
      "id, slug, first_name, last_name, category, is_new_face, instagram, updated_at, " +
        "model_translations(locale, display_name, bio, seo_title, seo_description, is_reviewed), " +
        "model_media(id, kind, bucket, storage_path, alt, width, height, credits, sort_order, in_comp_card), " +
        "model_representations(kind, offices(slug, city, office_translations(locale, name)))",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("getModelProfile", error.message);
    return fallbackProfile(slug, locale);
  }
  if (!data) return null;
  const row = data as unknown as Row;

  const { data: m } = await supabase.from("model_current_measurements").select("*").eq("model_id", row.id).maybeSingle();

  // Имя берём с языка страницы всегда (его вводят руками), а био и SEO — только если перевод
  // отмечен is_reviewed: непроверенный машинный текст не публикуем, вместо него английский.
  const own = row.model_translations?.find((t) => t.locale === locale);
  const en = row.model_translations?.find((t) => t.locale === "en");
  const tr = (own?.is_reviewed ? own : null) ?? en ?? own ?? row.model_translations?.[0];
  const name = own?.display_name || en?.display_name || [row.first_name, row.last_name].filter(Boolean).join(" ");

  const media = [...(row.model_media ?? [])]
    .filter((x): x is typeof x & { kind: MediaKind } => x.kind !== "video")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((x) => ({
      id: x.id,
      kind: x.kind,
      src: supabase.storage.from(x.bucket).getPublicUrl(x.storage_path).data.publicUrl,
      alt: x.alt ?? name,
      width: x.width,
      height: x.height,
      credits: x.credits,
      inCompCard: x.in_comp_card,
    }));

  const markets = (row.model_representations ?? [])
    .filter((r) => r.offices)
    .map((r) => ({
      slug: r.offices!.slug,
      kind: r.kind,
      name:
        r.offices!.office_translations?.find((t) => t.locale === locale)?.name ??
        r.offices!.office_translations?.find((t) => t.locale === "en")?.name ??
        r.offices!.city,
    }));

  return {
    id: row.id,
    slug: row.slug,
    name,
    category: row.category,
    isNewFace: row.is_new_face,
    instagram: row.instagram,
    bio: tr?.bio ?? null,
    seoTitle: tr?.seo_title ?? null,
    seoDescription: tr?.seo_description ?? null,
    measurements: m
      ? {
          heightCm: num(m.height_cm),
          bustCm: num(m.bust_cm),
          waistCm: num(m.waist_cm),
          hipsCm: num(m.hips_cm),
          shoeEu: num(m.shoe_eu),
          hairColor: m.hair_color,
          eyeColor: m.eye_color,
        }
      : null,
    media,
    markets,
    updatedAt: row.updated_at,
  };
});

/** Slug всех опубликованных моделей для generateStaticParams. */
export async function getPublishedModelSlugs(): Promise<string[]> {
  if (!hasSupabase()) return fallbackSlugs;
  const { data, error } = await createPublicClient().from("models").select("slug").eq("status", "published");
  if (error) {
    console.error("getPublishedModelSlugs", error.message);
    return [];
  }
  return data.map((r) => r.slug as string);
}

/** Обложка: первое фото cover, иначе первое из портфолио. */
export const coverOf = (p: ModelProfile) => p.media.find((x) => x.kind === "cover") ?? p.media[0] ?? null;

/** Фото для Comp Card: отмеченные in_comp_card, иначе первые по порядку, без обложки. */
export function compCardPhotos(p: ModelProfile, count = 4): ModelMedia[] {
  const cover = coverOf(p);
  const rest = p.media.filter((x) => x !== cover);
  const marked = rest.filter((x) => x.inCompCard);
  return (marked.length ? marked : rest).slice(0, count);
}

/**
 * Борд /models: все опубликованные модели по алфавиту, как на старом сайте.
 * Обложка — фото kind = cover, иначе первое по sort_order.
 */
export async function getBoard(locale: Locale): Promise<TalentCard[]> {
  if (!hasSupabase()) return fallbackBoard(locale);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("models")
    .select(
      "id, slug, first_name, last_name, category, is_new_face, " +
        "model_translations(locale, display_name, is_reviewed), " +
        "model_media(bucket, storage_path, alt, width, height, sort_order, kind)",
    )
    .eq("status", "published");

  if (error) {
    console.error("getBoard", error.message);
    return fallbackBoard(locale);
  }
  type BoardRow = Pick<Row, "id" | "slug" | "first_name" | "last_name" | "category" | "is_new_face" | "model_translations" | "model_media">;
  const rows = (data ?? []) as unknown as BoardRow[];
  if (!rows.length) return [];

  const { data: heights } = await supabase
    .from("model_current_measurements")
    .select("model_id, height_cm")
    .in("model_id", rows.map((r) => r.id));
  const heightById = new Map((heights ?? []).map((h) => [h.model_id as string, num(h.height_cm)]));

  return rows
    .map((r) => {
      const name =
        r.model_translations?.find((t) => t.locale === locale)?.display_name ||
        r.model_translations?.find((t) => t.locale === "en")?.display_name ||
        [r.first_name, r.last_name].filter(Boolean).join(" ");
      const photos = (r.model_media ?? []).filter((x) => x.kind !== "video");
      const media =
        photos.filter((x) => x.kind === "cover").sort((a, b) => a.sort_order - b.sort_order)[0] ??
        [...photos].sort((a, b) => a.sort_order - b.sort_order)[0];
      return {
        slug: r.slug,
        name,
        category: r.category,
        isNewFace: r.is_new_face,
        heightCm: heightById.get(r.id) ?? null,
        cover: media
          ? {
              src: supabase.storage.from(media.bucket).getPublicUrl(media.storage_path).data.publicUrl,
              alt: media.alt ?? name,
              width: media.width,
              height: media.height,
            }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

function fallbackBoard(locale: Locale): TalentCard[] {
  return fallbackSlugs
    .map((slug) => fallbackProfile(slug, locale)!)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      isNewFace: p.isNewFace,
      heightCm: p.measurements?.heightCm ?? null,
      cover: coverOf(p),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
