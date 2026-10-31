import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ageOn,
  ADULT_AGE,
  applicationSchema,
  CONSENT_VERSION,
  fieldErrors,
  PHOTO_SLOTS,
  photoKind,
  REQUIRED_PHOTOS,
  SCOUTING_BUCKET,
  scoutingPath,
  uploadRequestSchema,
  type PhotoSlot,
  type SubmitResponse,
  type UploadsResponse,
} from "./schema";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const MAX_PER_IP_PER_HOUR = 3;

/** Сырой IP не храним: соль из секрета сервера, хэш нужен только для лимита заявок. */
export function ipHash(headers: Headers): string | null {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}:${ip}`).digest("hex").slice(0, 32);
}

async function rateLimited(hash: string | null) {
  if (!hash) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await createAdminClient()
    .from("scouting_applications")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", hash)
    .gte("created_at", since);
  return (count ?? 0) >= MAX_PER_IP_PER_HOUR;
}

/**
 * Шаг 1. Выдаёт id будущей заявки и подписанные URL для прямой загрузки снепов в приватный bucket.
 * Файлы идут из браузера сразу в Supabase Storage, минуя лимит тела запроса Vercel (4,5 МБ).
 * Токен привязан к конкретному пути и живёт 2 часа; читать bucket анониму нельзя.
 */
export async function prepareUploads(input: unknown, hash: string | null): Promise<UploadsResponse> {
  const parsed = uploadRequestSchema.safeParse(input);
  if (!parsed.success || parsed.data.website) return { ok: false, error: "photos" };
  const slots = parsed.data.photos.map((p) => p.slot);
  if (new Set(slots).size !== slots.length || !REQUIRED_PHOTOS.every((k) => slots.includes(k))) {
    return { ok: false, error: "photos" };
  }
  if (await rateLimited(hash)) return { ok: false, error: "rateLimit" };

  const applicationId = randomUUID();
  const storage = createAdminClient().storage.from(SCOUTING_BUCKET);
  const uploads = [];
  for (const photo of parsed.data.photos) {
    const path = scoutingPath(applicationId, `${photo.slot}.${EXT[photo.mime]}`);
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) {
      console.error("createSignedUploadUrl", error?.message);
      return { ok: false, error: "server" };
    }
    uploads.push({ slot: photo.slot, path, token: data.token });
  }
  return { ok: true, applicationId, uploads };
}

/**
 * Шаг 2. Проверяет поля и загруженные файлы, создаёт заявку (status = pending) и строки scouting_media.
 * Триггер scouting_applications_notify ставит событие в notification_outbox;
 * отправку в Telegram запускает вызывающий код (flushOutboxAfterResponse).
 */
export async function submitApplication(input: unknown, hash: string | null): Promise<SubmitResponse> {
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "fields", fields: fieldErrors(parsed.error) };
  const v = parsed.data;

  if (v.website || Date.now() - v.startedAt < 4000) return { ok: false, error: "spam" };

  const supabase = createAdminClient();
  if (await rateLimited(hash)) return { ok: false, error: "rateLimit" };

  // Файлы должны реально лежать в папке заявки: путь знает только тот, кому выдали токен.
  const { data: files, error: listError } = await supabase.storage.from(SCOUTING_BUCKET).list(scoutingPath(v.applicationId));
  if (listError) {
    console.error("storage.list", listError.message);
    return { ok: false, error: "server" };
  }
  const media = (files ?? [])
    .map((f) => {
      const slot = f.name.split(".")[0] as PhotoSlot;
      const meta = f.metadata as { mimetype?: string; size?: number } | null;
      return { slot, name: f.name, mime: meta?.mimetype ?? "", size: meta?.size ?? 0 };
    })
    .filter((f) => PHOTO_SLOTS.includes(f.slot) && ["image/jpeg", "image/png", "image/webp"].includes(f.mime) && f.size > 0)
    .sort((a, b) => PHOTO_SLOTS.indexOf(a.slot) - PHOTO_SLOTS.indexOf(b.slot));
  if (!REQUIRED_PHOTOS.every((k) => media.some((m) => m.slot === k))) return { ok: false, error: "photos" };

  let officeId: string | null = null;
  if (v.market) {
    const { data: office } = await supabase.from("offices").select("id").eq("slug", v.market).eq("is_public", true).maybeSingle();
    officeId = office?.id ?? null;
  }

  const isMinor = ageOn(v.birthDate) < ADULT_AGE;
  const { data: app, error } = await supabase
    .from("scouting_applications")
    .insert({
      id: v.applicationId,
      status: "pending",
      office_id: officeId,
      ui_locale: v.locale,
      first_name: v.firstName,
      last_name: v.lastName,
      full_name: `${v.firstName} ${v.lastName}`,
      email: v.email,
      phone: v.phone,
      instagram: v.instagram ?? null,
      telegram: v.telegram ?? null,
      birth_date: v.birthDate,
      height_cm: v.heightCm,
      bust_cm: v.bustCm ?? null,
      waist_cm: v.waistCm ?? null,
      hips_cm: v.hipsCm ?? null,
      shoe_eu: v.shoeEu ?? null,
      eye_color: v.eyeColor ?? null,
      hair_color: v.hairColor ?? null,
      country: v.country,
      city: v.city,
      is_minor: isMinor,
      source: v.source,
      landing_path: v.landingPath ?? null,
      utm: v.utm,
      consent_version: isMinor ? `${CONSENT_VERSION}+guardian` : CONSENT_VERSION,
      ip_hash: hash,
    })
    .select("id, public_ref")
    .single();

  if (error || !app) {
    // 23505: повторная отправка с тем же id (двойной клик) — не создаём дубль.
    if (error?.code === "23505") return { ok: false, error: "duplicate" };
    console.error("insert scouting_applications", error?.message);
    return { ok: false, error: "server" };
  }

  const { error: mediaError } = await supabase.from("scouting_media").insert(
    media.map((m) => ({
      application_id: app.id,
      kind: photoKind(m.slot),
      storage_path: scoutingPath(app.id, m.name),
      mime_type: m.mime,
      size_bytes: m.size,
    })),
  );
  if (mediaError) console.error("insert scouting_media", mediaError.message);

  if (v.source === "scout") {
    await supabase.from("application_events").insert({
      application_id: app.id,
      note: `Прислал скаут: ${v.scoutName}${v.scoutContact ? `, ${v.scoutContact}` : ""}`,
    });
  }

  return { ok: true, ref: app.public_ref };
}
