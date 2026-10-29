import "server-only";
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

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://status-models.com";

// Префикс callback_data; разбирается в app/api/telegram/route.ts. Лимит Telegram 64 байта.
export const TAKE_SCOUTING = "take:";

export function adminButton(label: string, path: string) {
  return { text: label, url: `${siteUrl()}/en/admin${path}` };
}

/** Текст и кнопки сообщения для записи notification_outbox (payload собирают триггеры в 0001_init.sql). */
export function formatNotification(row: OutboxRow): { text: string; replyMarkup?: InlineKeyboard } {
  const p = row.payload;

  switch (row.event_type) {
    case "scouting.created": {
      const place = [p.city, p.country].filter(Boolean).map(e).join(", ");
      const details = [
        place && `📍 ${place}`,
        p.height_cm && `📏 ${e(p.height_cm)} см`,
        p.locale && `🌐 сайт: ${e(String(p.locale).toUpperCase())}`,
      ].filter(Boolean);
      return {
        text: [`🆕 <b>Новая заявка скаутинга</b> · <code>${e(p.ref)}</code>`, "", `<b>${e(p.name)}</b>`, ...details].join("\n"),
        replyMarkup: {
          inline_keyboard: [
            [{ text: "Взять в работу", callback_data: `${TAKE_SCOUTING}${row.entity_id}` }],
            [adminButton("Открыть в админке", `/scouting/${row.entity_id}`)],
          ],
        },
      };
    }

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
