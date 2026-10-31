import { NextResponse, type NextRequest } from "next/server";
import { flushOutboxAfterResponse } from "@/lib/notifications/schedule";
import { ipHash, submitApplication } from "@/lib/scouting/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Запас на отправку в Telegram после ответа: карточка + альбом из 5 фото.
export const maxDuration = 30;

/**
 * Шаг 2 анкеты: сохраняет заявку со статусом pending.
 * Telegram получает её сразу после ответа кандидатке через очередь notification_outbox:
 * если Telegram недоступен, заявка не теряется, а cron /api/cron/notifications повторит отправку.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const res = await submitApplication(body, ipHash(req.headers));
  if (res.ok) flushOutboxAfterResponse();
  const status = res.ok ? 201 : res.error === "rateLimit" ? 429 : res.error === "duplicate" ? 409 : res.error === "server" ? 500 : 400;
  return NextResponse.json(res, { status });
}
