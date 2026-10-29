import "server-only";
import { after } from "next/server";
import { flushOutbox } from "./worker";

/**
 * Вызывать из server action / route handler сразу после вставки, которая ставит запись в outbox
 * (например, новая заявка скаутинга). Отправка идёт после ответа пользователю, без ожидания cron.
 * Cron /api/cron/notifications остаётся страховкой для повторов и упавших отправок.
 */
export function flushOutboxAfterResponse() {
  after(async () => {
    try {
      await flushOutbox({ batchSize: 5 });
    } catch (err) {
      console.error("flushOutboxAfterResponse", err);
    }
  });
}
