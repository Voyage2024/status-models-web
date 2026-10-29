import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { flushOutbox } from "@/lib/notifications/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Vercel Cron (vercel.json) дёргает GET раз в минуту с Authorization: Bearer $CRON_SECRET.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Несколько пачек за один запуск, пока очередь не опустеет или не упрёмся в лимит Telegram.
  const started = Date.now();
  const total = { claimed: 0, sent: 0, failed: 0, rateLimited: false };
  try {
    while (Date.now() - started < 40_000) {
      const r = await flushOutbox({ batchSize: 20 });
      total.claimed += r.claimed;
      total.sent += r.sent;
      total.failed += r.failed;
      total.rateLimited ||= r.rateLimited;
      if (r.claimed < 20 || r.rateLimited) break;
    }
  } catch (err) {
    console.error("cron notifications", err);
    return NextResponse.json({ ...total, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
  return NextResponse.json(total);
}
