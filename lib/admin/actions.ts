"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasSupabase } from "@/lib/env";
import { isLocale, locales } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/paths";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSession } from "./auth";
import {
  fieldErrors,
  MEDIA_BUCKET,
  MEDIA_EXT,
  measurementsSchema,
  mediaPatchSchema,
  modelSchema,
  officesSchema,
  registerMediaSchema,
  reorderSchema,
  uploadRequestSchema,
  type ActionResult,
} from "./schema";

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

const forbidden = { ok: false as const, error: "forbidden" };
const serverError = (where: string, message?: string) => {
  console.error(`admin.${where}`, message);
  return { ok: false as const, error: "server" };
};

async function staffOrNull() {
  const session = await getSession();
  return session?.staff ? { supabase: session.supabase, staff: session.staff } : null;
}

/**
 * Проверка права править модель и заодно отметка updated_at (триггер из 0004).
 * RLS пропустит update только Owner или Booker офиса модели; scout и чужой booker получат 0 строк.
 */
async function touchModel(supabase: Supabase, modelId: string) {
  const { data, error } = await supabase.from("models").update({ updated_at: new Date().toISOString() }).eq("id", modelId).select("id");
  if (error) console.error("admin.touchModel", error.message);
  return Boolean(data?.length);
}

/** Публичные страницы на ISR (5 минут): после правки обновляем их сразу. */
function revalidateSite() {
  revalidatePath("/[locale]/models/[slug]", "page");
  revalidatePath("/[locale]/models", "page");
  revalidatePath("/[locale]", "page");
}

// ---------------------------------------------------------------------------
// Вход и выход
// ---------------------------------------------------------------------------

export async function signIn(_prev: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const locale = String(form.get("locale"));
  if (!isLocale(locale)) return { error: "invalid" };
  if (!hasSupabase()) return { error: "notConfigured" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) return { error: "invalid" };

  const { data: staff } = await supabase.from("staff").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!staff?.is_active) {
    await supabase.auth.signOut();
    return { error: "noAccess" };
  }
  redirect(href(locale, "/admin"));
}

export async function signOut(form: FormData) {
  const locale = String(form.get("locale"));
  if (hasSupabase()) await (await createServerSupabase()).auth.signOut();
  redirect(href(isLocale(locale) ? locale : "en", "/admin/login"));
}

// ---------------------------------------------------------------------------
// Модель: основное и переводы
// ---------------------------------------------------------------------------

export async function saveModel(input: unknown): Promise<ActionResult<{ id: string }>> {
  const s = await staffOrNull();
  if (!s) return forbidden;
  const parsed = modelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  const v = parsed.data;
  const { supabase } = s;
  const now = new Date().toISOString();

  const row = {
    first_name: v.firstName,
    last_name: v.lastName,
    slug: v.slug,
    category: v.category,
    status: v.status,
    is_new_face: v.isNewFace,
    instagram: v.instagram,
  };

  let id = v.id;
  if (!id) {
    // Новую модель заводит только Owner (политика models_owner_all); internal_code выдаёт база.
    if (s.staff.role !== "owner") return forbidden;
    const { data, error } = await supabase
      .from("models")
      .insert({ ...row, published_at: v.status === "published" ? now : null })
      .select("id")
      .single();
    if (error?.code === "23505") return { ok: false, error: "invalid", fields: { slug: "slugTaken" } };
    if (error || !data) return serverError("saveModel.insert", error?.message);
    id = data.id as string;
  } else {
    const { data: current } = await supabase.from("models").select("slug, published_at").eq("id", id).maybeSingle();
    if (!current) return forbidden;
    // slug уже в выдаче и в 301 со старого сайта: после публикации не трогаем.
    if (current.published_at && current.slug !== v.slug) return { ok: false, error: "invalid", fields: { slug: "slugLocked" } };
    const patch = { ...row, ...(v.status === "published" && !current.published_at ? { published_at: now } : {}) };
    const { data, error } = await supabase.from("models").update(patch).eq("id", id).select("id");
    if (error?.code === "23505") return { ok: false, error: "invalid", fields: { slug: "slugTaken" } };
    if (error) return serverError("saveModel.update", error.message);
    if (!data?.length) return forbidden;
  }

  // Переводы: локаль с пустым именем удаляем, сайт тогда возьмёт английский.
  const filled = v.translations.filter((t) => t.displayName);
  const empty = locales.filter((l) => !filled.some((t) => t.locale === l));
  if (filled.length) {
    const { error } = await supabase.from("model_translations").upsert(
      filled.map((t) => ({
        model_id: id,
        locale: t.locale,
        display_name: t.displayName,
        bio: t.bio || null,
        seo_title: t.seoTitle || null,
        seo_description: t.seoDescription || null,
        is_reviewed: t.isReviewed,
      })),
      { onConflict: "model_id,locale" },
    );
    if (error) return serverError("saveModel.translations", error.message);
  }
  if (empty.length) {
    const { error } = await supabase.from("model_translations").delete().eq("model_id", id).in("locale", empty);
    if (error) return serverError("saveModel.translations.delete", error.message);
  }

  revalidateSite();
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// Параметры
// ---------------------------------------------------------------------------

export async function saveMeasurements(input: unknown): Promise<ActionResult> {
  const s = await staffOrNull();
  if (!s) return forbidden;
  const parsed = measurementsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid", fields: fieldErrors(parsed.error) };
  const v = parsed.data;
  if (!(await touchModel(s.supabase, v.modelId))) return forbidden;

  // Одна запись на дату (уникальный индекс из 0004): тот же день правим, новый день — в историю.
  const { error } = await s.supabase.from("model_measurements").upsert(
    {
      model_id: v.modelId,
      height_cm: v.heightCm,
      bust_cm: v.bustCm,
      waist_cm: v.waistCm,
      hips_cm: v.hipsCm,
      shoe_eu: v.shoeEu,
      hair_color: v.hairColor,
      eye_color: v.eyeColor,
      measured_at: v.measuredAt,
      created_by: s.staff.id,
    },
    { onConflict: "model_id,measured_at" },
  );
  if (error) return serverError("saveMeasurements", error.message);
  revalidateSite();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Рынки (model_representations): только Owner
// ---------------------------------------------------------------------------

export async function saveOffices(input: unknown): Promise<ActionResult> {
  const s = await staffOrNull();
  if (!s || s.staff.role !== "owner") return forbidden;
  const parsed = officesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { modelId, officeIds } = parsed.data;

  let del = s.supabase.from("model_representations").delete().eq("model_id", modelId);
  if (officeIds.length) del = del.not("office_id", "in", `(${officeIds.join(",")})`);
  const { error: delError } = await del;
  if (delError) return serverError("saveOffices.delete", delError.message);
  if (officeIds.length) {
    // ignoreDuplicates: у существующих связей сохраняем kind и is_public.
    const { error } = await s.supabase
      .from("model_representations")
      .upsert(officeIds.map((office_id) => ({ model_id: modelId, office_id })), { onConflict: "model_id,office_id", ignoreDuplicates: true });
    if (error) return serverError("saveOffices.upsert", error.message);
  }
  await touchModel(s.supabase, modelId);
  revalidateSite();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Фото: подписанная загрузка в Storage → строки model_media
// ---------------------------------------------------------------------------

const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/;

/**
 * Шаг 1. Право на модель проверяет RLS (touchModel), после этого service_role подписывает
 * загрузку на конкретный путь models-public/<model_id>/<uuid>.<ext>. Файл идёт из браузера
 * прямо в Storage, минуя лимит Vercel 4,5 МБ на тело запроса.
 */
export async function prepareMediaUpload(input: unknown): Promise<ActionResult<{ uploads: Array<{ path: string; token: string }> }>> {
  const s = await staffOrNull();
  if (!s) return forbidden;
  const parsed = uploadRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { modelId, files } = parsed.data;
  if (!(await touchModel(s.supabase, modelId))) return forbidden;

  const storage = createAdminClient().storage.from(MEDIA_BUCKET);
  const uploads = [];
  for (const file of files) {
    const path = `${modelId}/${randomUUID()}.${MEDIA_EXT[file.mime]}`;
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) return serverError("prepareMediaUpload", error?.message);
    uploads.push({ path, token: data.token });
  }
  return { ok: true, uploads };
}

/** Шаг 2. Убеждаемся, что файлы реально в bucket, и пишем model_media в конец списка. */
export async function registerMedia(input: unknown): Promise<ActionResult> {
  const s = await staffOrNull();
  if (!s) return forbidden;
  const parsed = registerMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { modelId, kind, items } = parsed.data;
  if (items.some((i) => !PATH_RE.test(i.path) || !i.path.startsWith(`${modelId}/`))) return { ok: false, error: "invalid" };
  if (!(await touchModel(s.supabase, modelId))) return forbidden;

  const { data: listed, error: listError } = await createAdminClient().storage.from(MEDIA_BUCKET).list(modelId, { limit: 1000 });
  if (listError) return serverError("registerMedia.list", listError.message);
  const present = new Set((listed ?? []).map((f) => `${modelId}/${f.name}`));
  const uploaded = items.filter((i) => present.has(i.path));
  if (!uploaded.length) return { ok: false, error: "upload" };

  const [{ data: model }, { data: last }] = await Promise.all([
    s.supabase.from("models").select("first_name, last_name").eq("id", modelId).single(),
    s.supabase.from("model_media").select("sort_order").eq("model_id", modelId).order("sort_order", { ascending: false }).limit(1),
  ]);
  const start = (last?.[0]?.sort_order ?? 0) + 10;
  const alt = model ? [model.first_name, model.last_name].filter(Boolean).join(" ") : null;

  const { error } = await s.supabase.from("model_media").insert(
    uploaded.map((i, n) => ({
      model_id: modelId,
      kind,
      bucket: MEDIA_BUCKET,
      storage_path: i.path,
      width: i.width,
      height: i.height,
      alt,
      sort_order: start + n * 10,
    })),
  );
  if (error) return serverError("registerMedia.insert", error.message);
  revalidateSite();
  return uploaded.length === items.length ? { ok: true } : { ok: false, error: "upload" };
}

export async function updateMedia(input: unknown): Promise<ActionResult> {
  const s = await staffOrNull();
  if (!s) return forbidden;
  const parsed = mediaPatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  if (!(await touchModel(s.supabase, v.modelId))) return forbidden;

  const { data, error } = await s.supabase
    .from("model_media")
    .update({ kind: v.kind, alt: v.alt, credits: v.credits, is_public: v.isPublic, in_comp_card: v.inCompCard })
    .eq("id", v.id)
    .eq("model_id", v.modelId)
    .select("id");
  if (error) return serverError("updateMedia", error.message);
  if (!data?.length) return forbidden;
  revalidateSite();
  return { ok: true };
}

export async function reorderMedia(input: unknown): Promise<ActionResult> {
  const s = await staffOrNull();
  if (!s) return forbidden;
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { modelId, ids } = parsed.data;
  if (!(await touchModel(s.supabase, modelId))) return forbidden;

  const results = await Promise.all(
    ids.map((id, n) => s.supabase.from("model_media").update({ sort_order: (n + 1) * 10 }).eq("id", id).eq("model_id", modelId)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return serverError("reorderMedia", failed.error.message);
  revalidateSite();
  return { ok: true };
}

export async function deleteMedia(input: unknown): Promise<ActionResult> {
  const s = await staffOrNull();
  if (!s) return forbidden;
  const parsed = mediaPatchSchema.pick({ id: true, modelId: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { id, modelId } = parsed.data;
  if (!(await touchModel(s.supabase, modelId))) return forbidden;

  const { data, error } = await s.supabase.from("model_media").delete().eq("id", id).eq("model_id", modelId).select("bucket, storage_path");
  if (error) return serverError("deleteMedia", error.message);
  const row = data?.[0];
  if (!row) return forbidden;

  // Файл удаляем, только если на него больше не ссылается ни одна строка (скрипт заливки мог завести дубль).
  const admin = createAdminClient();
  const { count } = await admin
    .from("model_media")
    .select("id", { count: "exact", head: true })
    .eq("bucket", row.bucket)
    .eq("storage_path", row.storage_path);
  if (!count) {
    const { error: rmError } = await admin.storage.from(row.bucket).remove([row.storage_path]);
    if (rmError) console.error("admin.deleteMedia.storage", rmError.message);
  }
  revalidateSite();
  return { ok: true };
}
