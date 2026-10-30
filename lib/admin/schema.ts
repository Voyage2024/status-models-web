import { z } from "zod";
import { locales } from "@/lib/i18n/config";

// Схемы форм админки. Общие для клиента (подсказки) и server actions (проверка).
export const MODEL_STATUSES = ["draft", "published", "archived"] as const;
export const MODEL_CATEGORIES = ["women", "men", "new_faces", "other"] as const;
export const PHOTO_KINDS = ["cover", "portfolio", "digitals", "editorial", "campaign"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const MEDIA_BUCKET = "models-public";
export const MEDIA_MAX_BYTES = 20 * 1024 * 1024; // лимит bucket из 0002
export const MEDIA_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as const;
export type MediaMime = keyof typeof MEDIA_EXT;

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .default(null);

export const translationSchema = z.object({
  locale: z.enum(locales),
  displayName: text(120),
  bio: text(4000),
  seoTitle: text(120),
  seoDescription: text(320),
  isReviewed: z.boolean(),
});
export type TranslationInput = z.infer<typeof translationSchema>;

export const modelSchema = z.object({
  id: z.string().uuid().nullable(),
  firstName: text(80).min(1),
  lastName: optionalText(80),
  slug: z.string().trim().toLowerCase().max(80).regex(SLUG_RE),
  category: z.enum(MODEL_CATEGORIES),
  status: z.enum(MODEL_STATUSES),
  isNewFace: z.boolean(),
  // Принимаем @handle, handle или ссылку на профиль, храним handle без @.
  instagram: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "") || null)
    .refine((v) => v === null || /^[A-Za-z0-9._]{1,30}$/.test(v))
    .nullable()
    .default(null),
  translations: z.array(translationSchema).max(locales.length),
});
export type ModelInput = z.input<typeof modelSchema>;

const cm = (min: number, max: number) => z.number().min(min).max(max).nullable();

export const measurementsSchema = z.object({
  modelId: z.string().uuid(),
  heightCm: cm(100, 230),
  bustCm: cm(50, 150),
  waistCm: cm(40, 130),
  hipsCm: cm(50, 160),
  shoeEu: z.number().min(30).max(50).multipleOf(0.5).nullable(),
  hairColor: optionalText(40),
  eyeColor: optionalText(40),
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type MeasurementsInput = z.input<typeof measurementsSchema>;

export const uploadRequestSchema = z.object({
  modelId: z.string().uuid(),
  files: z
    .array(z.object({ mime: z.enum(Object.keys(MEDIA_EXT) as [MediaMime, ...MediaMime[]]), size: z.number().int().positive().max(MEDIA_MAX_BYTES) }))
    .min(1)
    .max(30),
});

export const registerMediaSchema = z.object({
  modelId: z.string().uuid(),
  kind: z.enum(PHOTO_KINDS),
  items: z
    .array(z.object({ path: z.string().max(200), width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable() }))
    .min(1)
    .max(30),
});

export const mediaPatchSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  kind: z.enum(PHOTO_KINDS),
  alt: optionalText(200),
  credits: optionalText(200),
  isPublic: z.boolean(),
  inCompCard: z.boolean(),
});
export type MediaPatch = z.input<typeof mediaPatchSchema>;

export const reorderSchema = z.object({ modelId: z.string().uuid(), ids: z.array(z.string().uuid()).max(200) });

export const officesSchema = z.object({ modelId: z.string().uuid(), officeIds: z.array(z.string().uuid()).max(50) });

export type FieldErrors = Record<string, string>;
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; fields?: FieldErrors };

/** zod-ошибки → { поле: код }; путь вида translations.1.displayName. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.code === "too_small" && issue.minimum === 1 ? "required" : "invalid";
  }
  return out;
}
