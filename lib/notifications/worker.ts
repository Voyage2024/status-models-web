import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, TelegramError } from "@/lib/telegram/api";
import { formatNotification, type OutboxRow } from "./format";

export type FlushResult = { claimed: number; sent: number; failed: number; rateLimited: boolean };

/**
 * Забирает пачку из notification_outbox (claim_notifications, FOR UPDATE SKIP LOCKED — параллельные
 * вызовы не пересекаются) и отправляет в Telegram. Итог каждой записи пишет complete_notification:
 * успех → sent, ошибка → failed с экспоненциальной паузой, после max_attempts → dead.
 */
export async function flushOutbox({ batchSize = 20 }: { batchSize?: number } = {}): Promise<FlushResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_notifications", { batch_size: batchSize });
  if (error) throw new Error(`claim_notifications: ${error.message}`);

  const rows = (data ?? []) as OutboxRow[];
  const result: FlushResult = { claimed: rows.length, sent: 0, failed: 0, rateLimited: false };
  const teamChat = process.env.TELEGRAM_TEAM_CHAT_ID;

  const complete = async (id: number, ok: boolean, err?: string) => {
    const { error } = await supabase.rpc("complete_notification", { p_id: id, p_ok: ok, p_error: err ?? null });
    if (error) console.error("complete_notification", id, error.message);
    if (ok) result.sent++;
    else result.failed++;
  };

  for (const row of rows) {
    // После 429 остаток пачки не шлём: вернётся в очередь с паузой.
    if (result.rateLimited) {
      await complete(row.id, false, "skipped: telegram rate limit");
      continue;
    }
    if (row.channel !== "telegram") {
      await complete(row.id, false, `unsupported channel ${row.channel}`);
      continue;
    }
    const chatId = row.chat_id ?? teamChat;
    if (!chatId) {
      await complete(row.id, false, "no chat_id and TELEGRAM_TEAM_CHAT_ID is not set");
      continue;
    }

    try {
      const { text, replyMarkup } = formatNotification(row);
      await sendMessage(chatId, text, replyMarkup);
      await complete(row.id, true);
    } catch (err) {
      if (err instanceof TelegramError && err.status === 429) result.rateLimited = true;
      await complete(row.id, false, err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}
