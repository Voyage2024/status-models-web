import "server-only";
import type { Locale } from "@/lib/i18n/config";
import type { createServerSupabase } from "@/lib/supabase/server";
import { MEDIA_BUCKET, type PhotoKind } from "./schema";

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

export type AdminModelRow = {
  id: string;
  code: string;
  slug: string;
  name: string;
  category: string;
  status: "draft" | "published" | "archived";
  thumb: string | null;
  locales: Array<{ locale: string; reviewed: boolean }>;
  updatedAt: string;
};

const publicUrl = (supabase: Supabase, bucket: string, path: string) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

/** Список для /admin: все статусы (RLS отдаёт персоналу и черновики), фильтры из query string. */
export async function listModels(
  supabase: Supabase,
  filters: { q?: string; status?: string; category?: string },
): Promise<AdminModelRow[]> {
  let query = supabase
    .from("models")
    .select(
      "id, internal_code, slug, first_name, last_name, category, status, updated_at, " +
        "model_translations(locale, is_reviewed), model_media(bucket, storage_path, kind, sort_order)",
    )
    .order("updated_at", { ascending: false })
    .limit(500);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  const q = filters.q?.trim().replace(/[,()%*\\]/g, " ").trim();
  if (q) query = query.or(["first_name", "last_name", "slug", "internal_code"].map((c) => `${c}.ilike.*${q}*`).join(","));

  const { data, error } = await query;
  if (error) {
    console.error("admin.listModels", error.message);
    return [];
  }
  type Row = {
    id: string;
    internal_code: string;
    slug: string;
    first_name: string;
    last_name: string | null;
    category: string;
    status: AdminModelRow["status"];
    updated_at: string;
    model_translations: Array<{ locale: string; is_reviewed: boolean }> | null;
    model_media: Array<{ bucket: string; storage_path: string; kind: string; sort_order: number }> | null;
  };
  return (data as unknown as Row[]).map((r) => {
    const media = [...(r.model_media ?? [])].filter((m) => m.kind !== "video").sort((a, b) => a.sort_order - b.sort_order);
    const cover = media.find((m) => m.kind === "cover") ?? media[0];
    return {
      id: r.id,
      code: r.internal_code,
      slug: r.slug,
      name: [r.first_name, r.last_name].filter(Boolean).join(" "),
      category: r.category,
      status: r.status,
      thumb: cover ? publicUrl(supabase, cover.bucket, cover.storage_path) : null,
      locales: (r.model_translations ?? []).map((t) => ({ locale: t.locale, reviewed: t.is_reviewed })),
      updatedAt: r.updated_at,
    };
  });
}

export type AdminMedia = {
  id: string;
  kind: PhotoKind;
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
  credits: string;
  isPublic: boolean;
  inCompCard: boolean;
};

export type AdminMeasurement = {
  measuredAt: string;
  heightCm: number | null;
  bustCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  shoeEu: number | null;
  hairColor: string | null;
  eyeColor: string | null;
};

export type AdminModel = {
  id: string;
  code: string;
  slug: string;
  firstName: string;
  lastName: string;
  category: "women" | "men" | "new_faces" | "other";
  status: AdminModelRow["status"];
  isNewFace: boolean;
  instagram: string;
  publishedAt: string | null;
  translations: Array<{ locale: Locale; displayName: string; bio: string; seoTitle: string; seoDescription: string; isReviewed: boolean }>;
  measurements: AdminMeasurement[];
  media: AdminMedia[];
  officeIds: string[];
};

const num = (v: unknown) => (v == null ? null : Number(v));

export async function getAdminModel(supabase: Supabase, id: string): Promise<AdminModel | null> {
  const { data, error } = await supabase
    .from("models")
    .select(
      "id, internal_code, slug, first_name, last_name, category, status, is_new_face, instagram, published_at, " +
        "model_translations(locale, display_name, bio, seo_title, seo_description, is_reviewed), " +
        "model_media(id, kind, bucket, storage_path, width, height, alt, credits, sort_order, is_public, in_comp_card), " +
        "model_representations(office_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("admin.getAdminModel", error.message);
  if (!data) return null;
  const r = data as unknown as {
    id: string;
    internal_code: string;
    slug: string;
    first_name: string;
    last_name: string | null;
    category: AdminModel["category"];
    status: AdminModel["status"];
    is_new_face: boolean;
    instagram: string | null;
    published_at: string | null;
    model_translations: Array<{ locale: Locale; display_name: string; bio: string | null; seo_title: string | null; seo_description: string | null; is_reviewed: boolean }> | null;
    model_media: Array<{ id: string; kind: PhotoKind | "video"; bucket: string; storage_path: string; width: number | null; height: number | null; alt: string | null; credits: string | null; sort_order: number; is_public: boolean; in_comp_card: boolean }> | null;
    model_representations: Array<{ office_id: string }> | null;
  };

  const { data: history } = await supabase
    .from("model_measurements")
    .select("measured_at, height_cm, bust_cm, waist_cm, hips_cm, shoe_eu, hair_color, eye_color")
    .eq("model_id", id)
    .order("measured_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    id: r.id,
    code: r.internal_code,
    slug: r.slug,
    firstName: r.first_name,
    lastName: r.last_name ?? "",
    category: r.category,
    status: r.status,
    isNewFace: r.is_new_face,
    instagram: r.instagram ?? "",
    publishedAt: r.published_at,
    translations: (r.model_translations ?? []).map((t) => ({
      locale: t.locale,
      displayName: t.display_name,
      bio: t.bio ?? "",
      seoTitle: t.seo_title ?? "",
      seoDescription: t.seo_description ?? "",
      isReviewed: t.is_reviewed,
    })),
    measurements: (history ?? []).map((m) => ({
      measuredAt: m.measured_at,
      heightCm: num(m.height_cm),
      bustCm: num(m.bust_cm),
      waistCm: num(m.waist_cm),
      hipsCm: num(m.hips_cm),
      shoeEu: num(m.shoe_eu),
      hairColor: m.hair_color,
      eyeColor: m.eye_color,
    })),
    media: [...(r.model_media ?? [])]
      .filter((m): m is typeof m & { kind: PhotoKind } => m.kind !== "video")
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        src: publicUrl(supabase, m.bucket || MEDIA_BUCKET, m.storage_path),
        width: m.width,
        height: m.height,
        alt: m.alt ?? "",
        credits: m.credits ?? "",
        isPublic: m.is_public,
        inCompCard: m.in_comp_card,
      })),
    officeIds: (r.model_representations ?? []).map((o) => o.office_id),
  };
}

export async function listOffices(supabase: Supabase) {
  const { data } = await supabase.from("offices").select("id, slug, city").order("sort_order").order("city");
  return (data ?? []) as Array<{ id: string; slug: string; city: string }>;
}
