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

/** Вызов Bot API. Ошибку Telegram превращает в TelegramError с retry_after для 429. */
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${requireEnv("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
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
  tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyMarkup && { reply_markup: replyMarkup }),
  });

export const answerCallbackQuery = (id: string, text: string) =>
  tg("answerCallbackQuery", { callback_query_id: id, text });

export const editReplyMarkup = (chatId: number, messageId: number, replyMarkup: InlineKeyboard) =>
  tg("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: replyMarkup });

export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
