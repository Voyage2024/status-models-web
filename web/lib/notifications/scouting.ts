import "server-only";
import ruModel from "@/lib/i18n/model/ru";
import { ageOn, PHOTO_SLOTS, SCOUTING_BUCKET, type PhotoSlot } from "@/lib/scouting/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml as e, sendMessage, sendPhotoAlbum, type InlineKeyboard } from "@/lib/telegram/api";
import { adminButton, TAKE_SCOUTING } from "./format";

/** Анкета так, как её видит уведомление: строка scouting_applications + офис + фото + заметка скаута. */
export type ScoutingCard = {
  id: string;
  public_ref: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  birth_date: string | null;
  is_minor: boolean;
  country: string | null;
  city: string | null;
  email: string;
  phone: string | null;
  instagram: string | null;
  telegram: string | null;
  height_cm: number | null;
  bust_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  shoe_eu: number | null;
  eye_color: string | null;
  hair_color: string | null;
  ui_locale: string;
  source: string;
  utm: Record<string, string> | null;
  office: { city: string } | null;
  media: Array<{ storage_path: string }>;
  scoutNote?: string | null;
};

const SLOT_LABEL: Record<PhotoSlot, string> = {
  portrait: "Анфас",
  profile: "Профиль",
  full_length: "Рост",
  extra_1: "Доп. 1",
  extra_2: "Доп. 2",
};

const slotOf = (path: string) => path.split("/").pop()!.split(".")[0] as PhotoSlot;
const color = (dict: Record<string, string>, v: string | null) => (v ? (dict[v.toLowerCase()] ?? v) : null);
const num = (v: number | null) => (v == null ? null : String(Number(v)));

export const instagramUrl = (h: string) => `https://instagram.com/${h}`;
export const telegramUrl = (h: string) => `https://t.me/${h}`;
export const whatsappUrl = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

function years(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? "год" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "года" : "лет"}`;
}

/** Кнопки карточки. takenBy — после «Взять в работу» первая кнопка становится отметкой. */
export function scoutingKeyboard(
  app: Pick<ScoutingCard, "id" | "instagram" | "telegram" | "phone">,
  takenBy?: string,
): InlineKeyboard {
  const socials = [
    app.instagram && { text: "Instagram", url: instagramUrl(app.instagram) },
    app.telegram && { text: "Telegram", url: telegramUrl(app.telegram) },
    app.phone && { text: "WhatsApp", url: whatsappUrl(app.phone) },
  ].filter((b): b is { text: string; url: string } => Boolean(b));
  return {
    inline_keyboard: [
      [
        takenBy
          ? { text: `✓ В работе: ${takenBy}`.slice(0, 64), callback_data: "noop" }
          : { text: "✋ Взять в работу", callback_data: `${TAKE_SCOUTING}${app.id}` },
      ],
      [adminButton("🗂 Открыть в админке", `/scouting/${app.id}`)],
      ...(socials.length ? [socials] : []),
    ],
  };
}

/** HTML-текст карточки для Telegram (parse_mode HTML, лимит 4096 символов — укладываемся с запасом). */
export function formatScoutingCard(app: ScoutingCard, now = new Date()): string {
  const name = [app.first_name, app.last_name].filter(Boolean).join(" ") || app.full_name;
  const age = app.birth_date ? ageOn(app.birth_date, now) : null;
  const birth = app.birth_date ? app.birth_date.split("-").reverse().join(".") : null;
  const bwh = [app.bust_cm, app.waist_cm, app.hips_cm].some((v) => v != null)
    ? [app.bust_cm, app.waist_cm, app.hips_cm].map((v) => num(v) ?? "—").join(" / ")
    : null;
  const eyes = color(ruModel.eyeColors, app.eye_color);
  const hair = color(ruModel.hairColors, app.hair_color);
  const utm = Object.entries(app.utm ?? {})
    .map(([k, v]) => `${k.replace(/^utm_/, "")}=${v}`)
    .join(", ");

  const params = [
    app.height_cm != null && `Рост <b>${e(num(app.height_cm))}</b>`,
    bwh && `<b>${e(bwh)}</b>`,
    app.shoe_eu != null && `обувь ${e(num(app.shoe_eu))} EU`,
  ].filter(Boolean);
  const looks = [eyes && `Глаза: ${e(eyes)}`, hair && `Волосы: ${e(hair)}`].filter(Boolean);

  const lines = [
    `🆕 <b>Новая анкета</b> · <code>${e(app.public_ref)}</code>`,
    "",
    `👤 <b>${e(name)}</b>`,
    age != null && `🎂 ${years(age)} · ${e(birth)}`,
    app.is_minor && "⚠️ <b>Несовершеннолетняя</b> — согласие родителя отмечено в анкете",
    `📍 ${e([app.city, app.country].filter(Boolean).join(", "))}`,
    app.office && `🎯 Рынок: ${e(app.office.city)}`,
    "",
    "<b>Параметры</b>",
    params.join(" · "),
    looks.length ? looks.join(" · ") : null,
    "",
    "<b>Контакты</b>",
    `✉️ ${e(app.email)}`,
    app.phone && `📞 <a href="${e(whatsappUrl(app.phone))}">${e(app.phone)}</a> · WhatsApp`,
    app.instagram && `📸 <a href="${e(instagramUrl(app.instagram))}">@${e(app.instagram)}</a>`,
    app.telegram && `✈️ <a href="${e(telegramUrl(app.telegram))}">@${e(app.telegram)}</a>`,
    "",
    app.scoutNote && `🔎 ${e(app.scoutNote)}`,
    `🌐 Сайт ${e(app.ui_locale.toUpperCase())}${app.source === "scout" ? " · через скаута" : ""}${utm ? ` · ${e(utm)}` : ""}`,
    `📷 Фото: ${app.media.length} — альбомом ниже`,
  ];
  return lines.filter((l) => l !== false && l !== null && l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Читает анкету целиком (service_role: уведомление шлёт сервер, RLS тут не нужен). */
export async function loadScoutingCard(id: string): Promise<ScoutingCard | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("scouting_applications")
    .select(
      "id, public_ref, first_name, last_name, full_name, birth_date, is_minor, country, city, email, phone, instagram, telegram, height_cm, bust_cm, waist_cm, hips_cm, shoe_eu, eye_color, hair_color, ui_locale, source, utm, office:offices(city), media:scouting_media(storage_path)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`load scouting ${id}: ${error.message}`);
  if (!data) return null;

  const { data: note } = await supabase
    .from("application_events")
    .select("note")
    .eq("application_id", id)
    .is("actor_id", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const card = data as unknown as ScoutingCard;
  card.media = [...card.media].sort((a, b) => PHOTO_SLOTS.indexOf(slotOf(a.storage_path)) - PHOTO_SLOTS.indexOf(slotOf(b.storage_path)));
  card.scoutNote = note?.note ?? null;
  return card;
}

/**
 * Карточка с кнопками, затем альбом снепов ответом на неё.
 * Ошибка карточки уходит наверх (запись outbox повторится). Ошибка альбома только логируется:
 * иначе повтор прислал бы карточку второй раз, а фото всё равно доступны по кнопке админки.
 */
export async function sendScoutingNotification(chatId: number | string, applicationId: string) {
  const app = await loadScoutingCard(applicationId);
  if (!app) throw new Error(`scouting application ${applicationId} not found`);

  const card = await sendMessage(chatId, formatScoutingCard(app), scoutingKeyboard(app));
  if (app.media.length < 2) return;

  try {
    const storage = createAdminClient().storage.from(SCOUTING_BUCKET);
    const photos = await Promise.all(
      app.media.slice(0, 10).map(async (m, i) => {
        const { data, error } = await storage.download(m.storage_path);
        if (error || !data) throw new Error(`download ${m.storage_path}: ${error?.message}`);
        const label = SLOT_LABEL[slotOf(m.storage_path)] ?? "Фото";
        return { blob: data, caption: i === 0 ? `<b>${e(app.full_name)}</b> · ${label}` : label };
      }),
    );
    await sendPhotoAlbum(chatId, photos, card.message_id);
  } catch (err) {
    console.error("scouting album", applicationId, err);
  }
}
