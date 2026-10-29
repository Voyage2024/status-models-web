import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminButton, TAKE_SCOUTING } from "@/lib/notifications/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerCallbackQuery, editReplyMarkup, sendMessage } from "@/lib/telegram/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TgUser = { id: number; first_name?: string; username?: string };
type TgChat = { id: number; type: string; title?: string };
type Update = {
  update_id: number;
  message?: { message_id: number; chat: TgChat; from?: TgUser; text?: string };
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    message?: { message_id: number; chat: TgChat };
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Telegram присылает секрет, заданный в setWebhook, в заголовке X-Telegram-Bot-Api-Secret-Token.
function authorized(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const update = (await req.json().catch(() => null)) as Update | null;
  try {
    if (update?.message?.text) await onMessage(update.message);
    else if (update?.callback_query) await onCallback(update.callback_query);
  } catch (err) {
    // Отвечаем 200 в любом случае: иначе Telegram будет повторять тот же update.
    console.error("telegram webhook", update?.update_id, err);
  }
  return NextResponse.json({ ok: true });
}

async function onMessage(msg: NonNullable<Update["message"]>) {
  // В группах команды приходят как /id@status_bot
  const command = msg.text?.trim().split(/\s+/)[0]?.split("@")[0]?.toLowerCase();
  if (command !== "/start" && command !== "/id") return;

  const lines = [
    "<b>STATUS INTERNATIONAL</b> · бот уведомлений",
    "",
    `chat_id этого чата: <code>${msg.chat.id}</code>`,
    msg.from && `ваш user_id: <code>${msg.from.id}</code>`,
    "",
    msg.chat.type === "private"
      ? "Чтобы получать личные уведомления и брать заявки кнопкой, владелец добавляет этот user_id в staff.telegram_chat_id."
      : "Чтобы бот писал в этот чат, укажите chat_id в TELEGRAM_TEAM_CHAT_ID.",
  ];
  await sendMessage(msg.chat.id, lines.filter((l) => l !== undefined).join("\n"));
}

async function onCallback(cb: NonNullable<Update["callback_query"]>) {
  if (cb.data === "noop") return answerCallbackQuery(cb.id, "");
  if (!cb.data?.startsWith(TAKE_SCOUTING)) return answerCallbackQuery(cb.id, "Неизвестное действие");

  const applicationId = cb.data.slice(TAKE_SCOUTING.length);
  if (!UUID.test(applicationId)) return answerCallbackQuery(cb.id, "Неверная ссылка на заявку");

  const supabase = createAdminClient();

  // Пользователь Telegram → сотрудник. Для личного чата chat_id совпадает с user_id.
  const { data: staff } = await supabase
    .from("staff")
    .select("id, role, full_name")
    .eq("telegram_chat_id", cb.from.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff) return answerCallbackQuery(cb.id, "Ваш Telegram не привязан к сотруднику. Отправьте боту /id");

  const { data: app } = await supabase
    .from("scouting_applications")
    .select("id, office_id, assigned_to")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return answerCallbackQuery(cb.id, "Заявка не найдена");

  // Те же правила, что в RLS: owner берёт любую, остальные только заявки своих офисов.
  if (staff.role !== "owner" && app.office_id) {
    const { count } = await supabase
      .from("staff_offices")
      .select("staff_id", { count: "exact", head: true })
      .eq("staff_id", staff.id)
      .eq("office_id", app.office_id);
    if (!count) return answerCallbackQuery(cb.id, "Заявка относится к другому офису");
  }

  // Условие assigned_to is null делает «взять» атомарным: из двух одновременных нажатий выиграет одно.
  const { data: taken } = await supabase
    .from("scouting_applications")
    .update({ assigned_to: staff.id, status: "in_review" })
    .eq("id", applicationId)
    .is("assigned_to", null)
    .select("id");

  if (!taken?.length) {
    return answerCallbackQuery(cb.id, app.assigned_to === staff.id ? "Заявка уже у вас" : "Заявку уже взял другой сотрудник");
  }

  await answerCallbackQuery(cb.id, "Заявка закреплена за вами");
  if (cb.message) {
    await editReplyMarkup(cb.message.chat.id, cb.message.message_id, {
      inline_keyboard: [
        [{ text: `✓ В работе: ${staff.full_name}`.slice(0, 64), callback_data: "noop" }],
        [adminButton("Открыть в админке", `/scouting/${applicationId}`)],
      ],
    });
  }
}
