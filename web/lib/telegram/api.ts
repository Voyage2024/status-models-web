import "server-only";
import { requireEnv } from "@/lib/env";

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
};

export type TgMessage = { message_id: number; chat: { id: number } };

/** Общий чат команды: TELEGRAM_CHAT_ID, для старых окружений — TELEGRAM_TEAM_CHAT_ID. */
export const teamChatId = () => process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_TEAM_CHAT_ID || undefined;

/**
 * Вызов Bot API. Ошибку Telegram превращает в TelegramError с retry_after для 429.
 * FormData уходит как multipart (загрузка файлов), остальное — JSON.
 */
export async function tg<T = unknown>(method: string, body: Record<string, unknown> | FormData, timeoutMs = 10_000): Promise<T> {
  const multipart = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${requireEnv("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST",
    headers: multipart ? undefined : { "content-type": "application/json" },
    body: multipart ? body : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; description?: string; parameters?: { retry_after?: number } }
    | null;

  if (!json?.ok) {
    const description = (json && "description" in json && json.description) || res.statusText;
    const retryAfter = json && !json.ok ? json.parameters?.retry_after : undefined;
    throw new TelegramError(`${method}: ${description}`, res.status, retryAfter);
  }
  return json.result;
}

export const sendMessage = (chatId: number | string, text: string, replyMarkup?: InlineKeyboard) =>
  tg<TgMessage>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyMarkup && { reply_markup: replyMarkup }),
  });

/**
 * Альбом фото (sendMediaGroup принимает 2–10 штук) файлами, а не ссылками: bucket приватный, а Telegram не всегда
 * успевает скачать файл по подписанному URL. replyTo привязывает альбом к карточке заявки.
 */
export async function sendPhotoAlbum(
  chatId: number | string,
  photos: Array<{ blob: Blob; caption?: string }>,
  replyTo?: number,
) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  if (replyTo) form.set("reply_parameters", JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
  form.set(
    "media",
    JSON.stringify(
      photos.map((p, i) => ({ type: "photo", media: `attach://p${i}`, ...(p.caption && { caption: p.caption, parse_mode: "HTML" }) })),
    ),
  );
  photos.forEach((p, i) => form.set(`p${i}`, p.blob, `p${i}.jpg`));
  return tg<TgMessage[]>("sendMediaGroup", form, 30_000);
}

export const answerCallbackQuery = (id: string, text: string) =>
  tg("answerCallbackQuery", { callback_query_id: id, text });

export const editReplyMarkup = (chatId: number, messageId: number, replyMarkup: InlineKeyboard) =>
  tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup });

export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
