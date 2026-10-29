# STATUS INTERNATIONAL — web

Next.js 15 (App Router) · Tailwind CSS 4 · TypeScript · Supabase · Vercel.

## Запуск

```bash
cp .env.example .env.local   # заполнить ключи
npm install
npm run dev                  # http://localhost:3000 → /en
```

Нужна миграция `db/0002_storage.sql` (buckets Storage). Без ключей Supabase главная рендерится на демо-данных (`lib/data/fallback.ts`): модели и рынки из аудита старого сайта, вместо фото монограммы.

## Структура

```
app/
  [locale]/                 en | ru | es | pt (generateStaticParams, dynamicParams = false)
    layout.tsx              <html lang>, шрифты, hreflang/canonical, шапка и футер
    page.tsx                главная: Hero → Selected Talent → Global Network → Direct access
    models/ models/[slug]   каталог и карточка модели (slug общий для всех языков)
    offices/ offices/[city] рынки (paris, milan, new-york, dubai, tokyo, sydney)
    become-a-model/         форма скаутинга (?source=scout для скаутов-партнёров)
    agency/ contact/ privacy/ admin/   заглушки
  api/
    telegram/route.ts       webhook бота
    cron/notifications/     воркер notification_outbox (Vercel Cron)
components/home/            блоки главной
components/layout/          шапка, переключатель языка, футер
lib/i18n/                   конфиг языков, словари, хелперы ссылок
lib/seo/legacy-redirects.ts карта 301/410 со старого WordPress (генерируется)
lib/notifications/          формат сообщений, воркер, flushOutboxAfterResponse()
lib/telegram/api.ts         тонкий клиент Bot API
middleware.ts               legacy 301/410 → снятие слеша → выбор языка
```

## Мультиязычность и SEO

- `middleware.ts` сначала сверяет путь с картой из `audit/url-inventory.csv`: один 301 на новый URL (без промежуточного 308 за счёт `skipTrailingSlashRedirect`) или 410 для мусора WordPress. Карту пересобирает `node scripts/gen-legacy-redirects.mjs ../audit/url-inventory.csv`.
- Корень `/` → язык из cookie `NEXT_LOCALE` или `Accept-Language`, иначе `/en`. Здесь 307, а не 301 из аудита: цель зависит от браузера, и 301 закэшировался бы навсегда. Googlebot без `Accept-Language` получает `/en`.
- Каждая страница отдаёт canonical и hreflang на 4 языка + `x-default`.
- Словари в `lib/i18n/dictionaries/*.ts`; `ru/es/pt` типизированы по `en`, пропущенный ключ — ошибка сборки.

## Telegram без внешнего сервера

1. Триггеры в Supabase (`0001_init.sql`) кладут события в `notification_outbox`.
2. `GET /api/cron/notifications` (Vercel Cron, раз в минуту, `Authorization: Bearer $CRON_SECRET`) вызывает `claim_notifications` → `sendMessage` → `complete_notification`. Повторы с экспоненциальной паузой и статус `dead` после `max_attempts` делает сама база. На 429 от Telegram остаток пачки откладывается.
3. Чтобы не ждать cron, server action формы после вставки заявки вызывает `flushOutboxAfterResponse()` — отправка идёт через `after()` сразу после ответа пользователю.
4. `POST /api/telegram` — webhook. Проверяет `X-Telegram-Bot-Api-Secret-Token`. Команды `/start` и `/id` возвращают chat_id/user_id для настройки. Кнопка «Взять в работу» под заявкой скаутинга атомарно ставит `assigned_to` (только если заявка свободна) с теми же правилами офисов, что в RLS, и меняет кнопку на «✓ В работе: имя».
5. После деплоя: `npm run telegram:webhook` с `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`.

Важно: на тарифе Vercel Hobby cron запускается не чаще раза в день, поминутный нужен Pro. На Hobby основная доставка идёт через `flushOutboxAfterResponse()`, а повторы можно дёргать pg_cron + pg_net из Supabase на тот же эндпоинт.

## Форма скаутинга (`/[locale]/become-a-model`)

`?source=scout` открывает режим скаута / агентства-партнёра. Поток:

1. Браузер сжимает снепы (до 2000 px, JPEG, без EXIF и геоданных) — `lib/scouting/image.ts`.
2. `prepareUploads()` (server action) проверяет тип и размер, выдаёт id будущей заявки и signed upload URL на `scouting/<id>/<kind>.jpg`.
3. Браузер грузит файлы прямо в Storage (`lib/scouting/upload.ts`), минуя лимит Vercel 4,5 МБ на тело запроса.
4. `submitApplication()` валидирует поля (zod, `lib/scouting/schema.ts`), проверяет, что 3 обязательных снепа реально загружены, вставляет `scouting_applications` + `scouting_media` через service_role, для скаута пишет заметку в `application_events`, и через `flushOutboxAfterResponse()` сразу шлёт уведомление в Telegram.

Защита: honeypot-поле, минимум 4 секунды на заполнение, не больше 3 заявок в час с одного IP (храним только хэш). Возраст от 14 лет; до 18 — обязательное согласие родителя, `is_minor` и `consent_version` с пометкой `+guardian`.
Снепы: фас, профиль, полный рост — обязательные, четвёртый (`other`) — по желанию.

## Страница модели и Comp Card

- `app/[locale]/models/[slug]/page.tsx`: обложка, параметры (см + дюймы/футы для зарубежных клиентов), рынки из `model_representations`, портфолио блоками по `model_media.kind` (portfolio, editorial, campaign, digitals), JSON-LD `Person`. ISR 5 минут, новые slug рендерятся по первому запросу. Данные: `lib/data/model.ts`, строки: `lib/i18n/model/*.ts`.
- Перевод био и SEO с языка страницы берётся, только если `model_translations.is_reviewed`, иначе английский.
- Без Supabase страницы работают на параметрах со старых страниц WordPress (`lib/data/model-fallback.ts`).
- `GET /{locale}/models/{slug}/comp-card` собирает PDF A5 из двух страниц на `@react-pdf/renderer` (лицо: обложка и имя; оборот: 4 фото, параметры, контакты). Фото для оборота: `model_media.in_comp_card`, иначе первые по порядку. Фото идут через `/_next/image`, чтобы ужать их до печатного размера и получить JPEG. Шрифты: статичные TTF в `lib/comp-card/fonts` (OFL), в функцию Vercel их кладёт `outputFileTracingIncludes`.
- Кэш: ETag по хэшу данных (будущий `comp_cards.data_hash`), CDN Vercel держит PDF час. Следующий шаг: сохранять PDF в bucket `comp-cards` и строку в `comp_cards`, чтобы не пересобирать на каждый промах кэша.
