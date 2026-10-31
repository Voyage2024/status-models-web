import { z } from "zod";

// Версия текста согласия. Меняется вместе с текстом в словарях: в заявке хранится, на что согласились.
export const CONSENT_VERSION = "2026-10-scouting-v1";

export const MIN_AGE = 14;
export const ADULT_AGE = 18;

// Bucket и папка в нём: scouting/scouting-applications/<id заявки>/<слот>.jpg
export const SCOUTING_BUCKET = "scouting";
export const SCOUTING_FOLDER = "scouting-applications";
export const scoutingPath = (applicationId: string, file = "") => `${SCOUTING_FOLDER}/${applicationId}/${file}`;

// Слоты формы: три обязательных ракурса и два дополнительных. Слот = имя файла в Storage.
export const PHOTO_SLOTS = ["portrait", "profile", "full_length", "extra_1", "extra_2"] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];
export const REQUIRED_PHOTOS: readonly PhotoSlot[] = ["portrait", "profile", "full_length"];
export const MAX_PHOTOS = PHOTO_SLOTS.length;

/** Слот → значение enum scouting_photo_kind в базе (дополнительные снимки идут как other). */
export const photoKind = (slot: PhotoSlot) => (slot.startsWith("extra_") ? "other" : slot) as "portrait" | "profile" | "full_length" | "other";

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // до сжатия на клиенте; после него обычно 300–900 КБ

// Цвета хранятся по-английски, как в model_measurements; подписи берутся из словарей hairColors/eyeColors.
export const HAIR_COLORS = ["Black", "Dark brown", "Brown", "Light brown", "Auburn", "Red", "Dark blonde", "Blonde", "Light blonde", "Grey"] as const;
export const EYE_COLORS = ["Brown", "Dark brown", "Hazel", "Green", "Grey-green", "Blue", "Grey-blue", "Blue-green", "Grey", "Black"] as const;

export function ageOn(birthDate: string, now = new Date()): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));

// Пустая строка из формы = не указано; иначе число в диапазоне.
const optionalNumber = (min: number, max: number, code: string) =>
  z
    .union([z.literal(""), z.coerce.number({ invalid_type_error: code }).min(min, code).max(max, code)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v));

// Ник из «@name», «name» или ссылки на профиль.
const handle = (re: RegExp, strip: RegExp) =>
  optionalText(80)
    .transform((v) => v?.replace(strip, "").replace(/^@/, "").replace(/[/?#].*$/, ""))
    .refine((v) => !v || re.test(v), "handle");

// Коды ошибок, а не тексты: переводы лежат в словаре scouting.errors.
export const applicationSchema = z
  .object({
    applicationId: z.string().uuid(),
    firstName: z.string().trim().min(1, "required").max(60, "tooLong"),
    lastName: z.string().trim().min(1, "required").max(60, "tooLong"),
    email: z.string().trim().toLowerCase().min(1, "required").email("email").max(200, "tooLong"),
    phone: z
      .string()
      .trim()
      .min(1, "required")
      .max(40, "tooLong")
      .refine((v) => /^\+?[\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 7, "phone"),
    instagram: handle(/^[A-Za-z0-9._]{1,30}$/, /^https?:\/\/(www\.)?instagram\.com\//i),
    telegram: handle(/^[A-Za-z][A-Za-z0-9_]{3,31}$/, /^https?:\/\/(www\.)?t(elegram)?\.me\//i),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "required"),
    country: z.string().trim().min(2, "required").max(80, "tooLong"),
    city: z.string().trim().min(2, "required").max(80, "tooLong"),
    market: optionalText(40), // slug офиса; пусто = «на усмотрение агентства»
    heightCm: z.coerce.number({ invalid_type_error: "height" }).min(140, "height").max(210, "height"),
    bustCm: optionalNumber(60, 140, "measure"),
    waistCm: optionalNumber(45, 110, "measure"),
    hipsCm: optionalNumber(60, 140, "measure"),
    shoeEu: optionalNumber(33, 48, "shoe"),
    eyeColor: z.enum(EYE_COLORS).or(z.literal("")).optional().transform((v) => v || undefined),
    hairColor: z.enum(HAIR_COLORS).or(z.literal("")).optional().transform((v) => v || undefined),
    consent: z.literal(true, { errorMap: () => ({ message: "consent" }) }),
    guardianConsent: z.boolean().optional(),
    // Режим скаута / агентства-партнёра
    source: z.enum(["website", "scout"]).default("website"),
    scoutName: optionalText(120),
    scoutContact: optionalText(200),
    // Антиспам: скрытое поле должно остаться пустым, форму не заполняют быстрее 4 секунд
    website: z.string().max(0, "spam").optional(),
    startedAt: z.coerce.number(),
    landingPath: optionalText(300),
    utm: z.record(z.string().max(200)).default({}),
    locale: z.enum(["en", "ru", "es", "pt"]),
  })
  .superRefine((v, ctx) => {
    const age = ageOn(v.birthDate);
    if (Number.isNaN(age) || age > 80) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "required" });
    else if (age < MIN_AGE) ctx.addIssue({ code: "custom", path: ["birthDate"], message: "tooYoung" });
    else if (age < ADULT_AGE && !v.guardianConsent)
      ctx.addIssue({ code: "custom", path: ["guardianConsent"], message: "guardian" });
    if (v.source === "scout" && !v.scoutName) ctx.addIssue({ code: "custom", path: ["scoutName"], message: "required" });
  });

export type ApplicationInput = z.input<typeof applicationSchema>;

export const uploadRequestSchema = z.object({
  photos: z
    .array(
      z.object({
        slot: z.enum(PHOTO_SLOTS),
        mime: z.enum(ALLOWED_MIME),
        size: z.number().int().positive().max(MAX_PHOTO_BYTES),
      }),
    )
    .min(REQUIRED_PHOTOS.length)
    .max(MAX_PHOTOS),
  website: z.string().max(0).optional(),
});

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

// Ответы /api/scouting/uploads и /api/scouting
export type ScoutingFail = { ok: false; error: string; fields?: FieldErrors };
export type UploadsResponse =
  | { ok: true; applicationId: string; uploads: Array<{ slot: PhotoSlot; path: string; token: string }> }
  | ScoutingFail;
export type SubmitResponse = { ok: true; ref: string } | ScoutingFail;
