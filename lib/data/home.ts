import "server-only";
import { hasSupabase } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { createPublicClient } from "@/lib/supabase/public";
import { fallbackOffices, fallbackTalent } from "./fallback";
import type { OfficeCard, TalentCard } from "./types";

type Translation = { locale: string; display_name?: string; name?: string };

function pickTranslation<T extends Translation>(rows: T[] | null, locale: Locale): T | undefined {
  return rows?.find((r) => r.locale === locale) ?? rows?.find((r) => r.locale === "en") ?? rows?.[0];
}

/** Опубликованные модели с обложкой для блока Selected Talent. */
export async function getSelectedTalent(locale: Locale, limit = 6): Promise<TalentCard[]> {
  if (!hasSupabase()) return fallbackTalent.slice(0, limit);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("models")
    .select(
      "id, slug, first_name, last_name, category, is_new_face, " +
        "model_translations(locale, display_name), " +
        "model_media(bucket, storage_path, alt, width, height, sort_order, kind)",
    )
    .eq("status", "published")
    .eq("model_media.kind", "cover")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getSelectedTalent", error.message);
    return fallbackTalent.slice(0, limit);
  }
  if (!data?.length) return [];

  type Row = {
    id: string;
    slug: string;
    first_name: string;
    last_name: string | null;
    category: TalentCard["category"];
    is_new_face: boolean;
    model_translations: Array<{ locale: string; display_name: string }> | null;
    model_media: Array<{ bucket: string; storage_path: string; alt: string | null; width: number | null; height: number | null; sort_order: number }> | null;
  };
  const rows = data as unknown as Row[];

  const { data: heights } = await supabase
    .from("model_current_measurements")
    .select("model_id, height_cm")
    .in("model_id", rows.map((r) => r.id));
  const heightById = new Map((heights ?? []).map((h) => [h.model_id as string, h.height_cm as number | null]));

  return rows.map((r) => {
    const name = pickTranslation(r.model_translations, locale)?.display_name ?? [r.first_name, r.last_name].filter(Boolean).join(" ");
    const media = [...(r.model_media ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
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
  });
}

/** Публичные офисы / рынки для блока Global Network. */
export async function getOffices(locale: Locale): Promise<OfficeCard[]> {
  if (!hasSupabase()) return fallbackOffices;

  const { data, error } = await createPublicClient()
    .from("offices")
    .select("slug, city, country, office_translations(locale, name)")
    .eq("is_public", true)
    .order("sort_order");

  if (error || !data?.length) {
    if (error) console.error("getOffices", error.message);
    return fallbackOffices;
  }

  return data.map((o) => ({
    slug: o.slug,
    city: o.city,
    country: o.country,
    name: pickTranslation(o.office_translations as Translation[] | null, locale)?.name ?? o.city,
  }));
}
