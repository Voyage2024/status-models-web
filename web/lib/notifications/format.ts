import "server-only";
import { siteUrl } from "@/lib/site-url";
import { escapeHtml as e, type InlineKeyboard } from "@/lib/telegram/api";

export type OutboxRow = {
  id: number;
  channel: string;
  event_type: string;
  entity_id: string;
  chat_id: number | null;
  payload: Record<string, unknown>;
  attempts: number;
};


// Префикс callback_data; разбирается в app/api/telegram/route.ts. Лимит Telegram 64 байта.
export const TAKE_SCOUTING = "take:";

// Язык админки в ссылках из Telegram: команда работает на русском, en тоже поддерживается.
const ADMIN_LOCALE = process.env.TELEGRAM_ADMIN_LOCALE === "en" ? "en" : "ru";

export function adminButton(label: string, path: string) {
  return { text: label, url: `${siteUrl()}/${ADMIN_LOCALE}/admin${path}` };
}

/**
 * Текст и кнопки сообщения для записи notification_outbox (payload собирают триггеры в 0001_init.sql).
 * scouting.created сюда не попадает: карточку с фото собирает lib/notifications/scouting.ts.
 */
export function formatNotification(row: OutboxRow): { text: string; replyMarkup?: InlineKeyboard } {
  const p = row.payload;

  switch (row.event_type) {
    case "booking.created": {
      const details = [
        p.company && `🏢 <b>${e(p.company)}</b>`,
        p.name && `👤 ${e(p.name)}`,
        p.job_type && `🎬 ${e(p.job_type)}`,
      ].filter(Boolean);
      return {
        text: [`📩 <b>Запрос на букинг</b>`, "", ...details].join("\n"),
        replyMarkup: { inline_keyboard: [[adminButton("Открыть в админке", `/bookings/${row.entity_id}`)]] },
      };
    }

    default:
      return { text: `🔔 <b>${e(row.event_type)}</b>\n<pre>${e(JSON.stringify(p, null, 2))}</pre>` };
  }
}
