import { z } from "zod";

// Версия текста согласия. Меняется вместе с текстом в словарях: в заявке хранится, на что согласились.
export const CONSENT_VERSION = "2026-10-scouting-v1";

export const MIN_AGE = 14;
export const ADULT_AGE = 18;

export const PHOTO_KINDS = ["portrait", "profile", "full_length", "other"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
export const REQUIRED_PHOTOS: readonly PhotoKind[] = ["portrait", "profile", "full_length"];

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // до сжатия на клиенте; после него обычно 300–900 КБ

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
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

// Коды ошибок, а не тексты: переводы лежат в словаре scouting.errors.
export const applicationSchema = z
  .object({
    applicationId: z.string().uuid(),
    fullName: z.string().trim().min(2, "required").max(120, "tooLong"),
    email: z.string().trim().toLowerCase().email("email").max(200),
    phone: optionalText(40),
    instagram: optionalText(60).transform((v) => v?.replace(/^@|^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "")),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "required"),
    heightCm: z.coerce.number({ invalid_type_error: "required" }).min(140, "height").max(210, "height"),
    country: z.string().trim().min(2, "required").max(80),
    city: optionalText(80),
    market: optionalText(40), // slug офиса; пусто = «на усмотрение агентства»
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
        kind: z.enum(PHOTO_KINDS),
        mime: z.enum(ALLOWED_MIME),
        size: z.number().int().positive().max(MAX_PHOTO_BYTES),
      }),
    )
    .min(REQUIRED_PHOTOS.length)
    .max(PHOTO_KINDS.length),
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
