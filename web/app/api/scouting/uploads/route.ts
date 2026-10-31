import { NextResponse, type NextRequest } from "next/server";
import { ipHash, prepareUploads } from "@/lib/scouting/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Шаг 1 анкеты: подписанные URL для загрузки снепов прямо из браузера в Supabase Storage.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const res = await prepareUploads(body, ipHash(req.headers));
  return NextResponse.json(res, { status: res.ok ? 200 : res.error === "rateLimit" ? 429 : 400 });
}
