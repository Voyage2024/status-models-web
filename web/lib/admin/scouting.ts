import "server-only";
import { PHOTO_SLOTS, SCOUTING_BUCKET, type PhotoSlot } from "@/lib/scouting/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createServerSupabase } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

export const APPLICATION_STATUSES = ["pending", "in_review", "shortlisted", "invited", "signed", "rejected", "spam"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ApplicationRow = {
  id: string;
  ref: string;
  status: ApplicationStatus;
  name: string;
  birthDate: string | null;
  isMinor: boolean;
  place: string;
  heightCm: number | null;
  source: string;
  assignedTo: string | null;
  createdAt: string;
  thumb: string | null;
};

const slotOf = (path: string) => path.split("/").pop()!.split(".")[0] as PhotoSlot;

/**
 * Подписанные ссылки на снепы (bucket приватный). Подписывает service_role, но только пути,
 * которые сотрудник уже получил из scouting_media под своим RLS — чужие заявки сюда не попадают.
 */
async function signPaths(paths: string[], seconds = 3600) {
  if (!paths.length) return new Map<string, string>();
  const { data, error } = await createAdminClient().storage.from(SCOUTING_BUCKET).createSignedUrls(paths, seconds);
  if (error) console.error("admin.scouting.sign", error.message);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}

export async function listApplications(
  supabase: Supabase,
  filters: { q?: string; status?: string; mine?: string },
): Promise<ApplicationRow[]> {
  let query = supabase
    .from("scouting_applications")
    .select("id, public_ref, status, full_name, birth_date, is_minor, city, country, height_cm, source, assigned_to, created_at, media:scouting_media(storage_path)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.mine) query = query.eq("assigned_to", filters.mine);
  if (filters.q) {
    const q = filters.q.replace(/[%,()]/g, " ").trim();
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,public_ref.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("admin.listApplications", error.message);
    return [];
  }
  const rows = data ?? [];
  const thumbs = rows.map((r) => (r.media as Array<{ storage_path: string }>).find((m) => slotOf(m.storage_path) === "portrait")?.storage_path);
  const signed = await signPaths(thumbs.filter((p): p is string => Boolean(p)));
  return rows.map((r, i) => ({
    id: r.id,
    ref: r.public_ref,
    status: r.status,
    name: r.full_name,
    birthDate: r.birth_date,
    isMinor: r.is_minor,
    place: [r.city, r.country].filter(Boolean).join(", "),
    heightCm: r.height_cm == null ? null : Number(r.height_cm),
    source: r.source,
    assignedTo: r.assigned_to,
    createdAt: r.created_at,
    thumb: thumbs[i] ? (signed.get(thumbs[i]!) ?? null) : null,
  }));
}

export async function getApplication(supabase: Supabase, id: string) {
  const { data, error } = await supabase
    .from("scouting_applications")
    .select(
      "*, office:offices(city), assignee:staff!scouting_applications_assigned_to_fkey(full_name), media:scouting_media(storage_path, size_bytes), events:application_events(id, from_status, to_status, note, created_at, actor:staff(full_name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) console.error("admin.getApplication", error.message);
  if (!data) return null;

  const media = [...(data.media as Array<{ storage_path: string; size_bytes: number }>)].sort(
    (a, b) => PHOTO_SLOTS.indexOf(slotOf(a.storage_path)) - PHOTO_SLOTS.indexOf(slotOf(b.storage_path)),
  );
  const signed = await signPaths(media.map((m) => m.storage_path));
  const events = [...(data.events as Array<{ id: number; from_status: string | null; to_status: string | null; note: string | null; created_at: string; actor: { full_name: string } | null }>)].sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );

  return {
    id: data.id as string,
    ref: data.public_ref as string,
    status: data.status as ApplicationStatus,
    firstName: data.first_name as string | null,
    lastName: data.last_name as string | null,
    name: data.full_name as string,
    email: data.email as string,
    phone: data.phone as string | null,
    instagram: data.instagram as string | null,
    telegram: data.telegram as string | null,
    birthDate: data.birth_date as string | null,
    isMinor: data.is_minor as boolean,
    country: data.country as string | null,
    city: data.city as string | null,
    office: (data.office as { city: string } | null)?.city ?? null,
    heightCm: data.height_cm as number | null,
    bustCm: data.bust_cm as number | null,
    waistCm: data.waist_cm as number | null,
    hipsCm: data.hips_cm as number | null,
    shoeEu: data.shoe_eu as number | null,
    eyeColor: data.eye_color as string | null,
    hairColor: data.hair_color as string | null,
    source: data.source as string,
    uiLocale: data.ui_locale as string,
    utm: (data.utm ?? {}) as Record<string, string>,
    assignedTo: data.assigned_to as string | null,
    assignee: (data.assignee as { full_name: string } | null)?.full_name ?? null,
    createdAt: data.created_at as string,
    photos: media.map((m) => ({ slot: slotOf(m.storage_path), url: signed.get(m.storage_path) ?? null })),
    events,
  };
}

export type AdminApplication = NonNullable<Awaited<ReturnType<typeof getApplication>>>;
