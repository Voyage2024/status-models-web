// Регистрирует webhook бота на /api/telegram. Запуск после деплоя:
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... NEXT_PUBLIC_SITE_URL=https://status-models.com npm run telegram:webhook
const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret, NEXT_PUBLIC_SITE_URL: site } = process.env;
if (!token || !secret || !site) {
  console.error("Нужны TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET и NEXT_PUBLIC_SITE_URL");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: new URL("/api/telegram", site).toString(),
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  }),
});
console.log(await res.json());
