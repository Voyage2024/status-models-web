"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { flushOutboxAfterResponse } from "@/lib/notifications/schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ageOn,
  ADULT_AGE,
  applicationSchema,
  CONSENT_VERSION,
  fieldErrors,
  REQUIRED_PHOTOS,
  uploadRequestSchema,
  type FieldErrors,
  type PhotoKind,
} from "./schema";

const BUCKET = "scouting";
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const MAX_PER_IP_PER_HOUR = 3;

type Fail = { ok: false; error: string; fields?: FieldErrors };

async function ipHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (!ip) return null;
  // Сырой IP не храним: соль из секрета сервера, хэш нужен только для лимита заявок.
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
export async function prepareUploads(
  input: unknown,
): Promise<{ ok: true; applicationId: string; uploads: Array<{ kind: PhotoKind; path: string; token: string }> } | Fail> {
  const parsed = uploadRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "photos" };
  const kinds = parsed.data.photos.map((p) => p.kind);
  if (new Set(kinds).size !== kinds.length || !REQUIRED_PHOTOS.every((k) => kinds.includes(k))) {
    return { ok: false, error: "photos" };
  }
  if (await rateLimited(await ipHash())) return { ok: false, error: "rateLimit" };

  const applicationId = randomUUID();
  const storage = createAdminClient().storage.from(BUCKET);
  const uploads = [];
  for (const photo of parsed.data.photos) {
    const path = `${applicationId}/${photo.kind}.${EXT[photo.mime]}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) {
      console.error("createSignedUploadUrl", error?.message);
      return { ok: false, error: "server" };
    }
    uploads.push({ kind: photo.kind, path, token: data.token });
  }
  return { ok: true, applicationId, uploads };
}

/**
 * Шаг 2. Проверяет поля и загруженные файлы, создаёт заявку и строки scouting_media.
 * Триггер scouting_applications_notify ставит событие в notification_outbox,
 * а flushOutboxAfterResponse() отправляет его в Telegram сразу после ответа.
 */
export async function submitApplication(input: unknown): Promise<{ ok: true; ref: string } | Fail> {
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "fields", fields: fieldErrors(parsed.error) };
  const v = parsed.data;

  if (v.website || Date.now() - v.startedAt < 4000) return { ok: false, error: "spam" };

  const supabase = createAdminClient();
  const hash = await ipHash();
  if (await rateLimited(hash)) return { ok: false, error: "rateLimit" };

  // Файлы должны реально лежать в папке заявки: путь знает только тот, кому выдали токен.
  const { data: files, error: listError } = await supabase.storage.from(BUCKET).list(v.applicationId);
  if (listError) {
    console.error("storage.list", listError.message);
    return { ok: false, error: "server" };
  }
  const media = (files ?? [])
    .map((f) => {
      const kind = f.name.split(".")[0] as PhotoKind;
      const meta = f.metadata as { mimetype?: string; size?: number } | null;
      return { kind, name: f.name, mime: meta?.mimetype ?? "", size: meta?.size ?? 0 };
    })
    .filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.mime) && f.size > 0);
  if (!REQUIRED_PHOTOS.every((k) => media.some((m) => m.kind === k))) return { ok: false, error: "photos" };

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
      office_id: officeId,
      ui_locale: v.locale,
      full_name: v.fullName,
      email: v.email,
      phone: v.phone ?? null,
      instagram: v.instagram ?? null,
      birth_date: v.birthDate,
      height_cm: v.heightCm,
      country: v.country,
      city: v.city ?? null,
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
      kind: m.kind,
      storage_path: `${app.id}/${m.name}`,
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

  flushOutboxAfterResponse();
  return { ok: true, ref: app.public_ref };
}
