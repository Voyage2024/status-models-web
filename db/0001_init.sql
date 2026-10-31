-- STATUS INTERNATIONAL — черновик схемы Supabase (миграция 0001)
-- Роли персонала: owner / booker / scout. Публичный сайт читает только опубликованное.
-- Заявки пишет серверный route handler (service_role) после валидации, rate limit и проверки файлов.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Типы
-- ---------------------------------------------------------------------------
create type app_role            as enum ('owner', 'booker', 'scout');
create type site_locale         as enum ('en', 'ru', 'es', 'pt');
create type model_status        as enum ('draft', 'published', 'archived');
create type model_category      as enum ('women', 'men', 'new_faces', 'other');
create type representation_kind as enum ('mother_agency', 'main', 'direct', 'placement');
create type media_kind          as enum ('cover', 'portfolio', 'digitals', 'editorial', 'campaign', 'video');
create type application_status  as enum ('new', 'in_review', 'shortlisted', 'invited', 'signed', 'rejected', 'spam');
create type scouting_photo_kind as enum ('portrait', 'profile', 'full_length', 'other');
create type inquiry_status      as enum ('new', 'in_progress', 'options_sent', 'confirmed', 'closed', 'spam');
create type notification_status as enum ('pending', 'processing', 'sent', 'failed', 'dead');

-- ---------------------------------------------------------------------------
-- Офисы и персонал
-- ---------------------------------------------------------------------------
create table offices (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,                 -- paris, milan, new-york ...
  city        text not null,
  country     text not null,
  email       citext,
  phone       text,
  timezone    text not null default 'UTC',
  is_public   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table office_translations (
  office_id        uuid not null references offices(id) on delete cascade,
  locale           site_locale not null,
  name             text not null,
  body             text,
  seo_title        text,
  seo_description  text,
  primary key (office_id, locale)
);

-- Сотрудник = пользователь Supabase Auth с ролью.
create table staff (
  id                uuid primary key references auth.users(id) on delete cascade,
  role              app_role not null,
  full_name         text not null,
  telegram_chat_id  bigint,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- Booker и Scout видят только данные своих офисов.
create table staff_offices (
  staff_id   uuid not null references staff(id) on delete cascade,
  office_id  uuid not null references offices(id) on delete cascade,
  primary key (staff_id, office_id)
);

-- ---------------------------------------------------------------------------
-- Модели
-- ---------------------------------------------------------------------------
create table models (
  id                      uuid primary key default gen_random_uuid(),
  internal_code           text not null unique,     -- внутренний ID для поиска, напр. SI-0042
  slug                    text not null unique,     -- общий для всех языков: /en/models/kira-raab
  first_name              text not null,
  last_name               text,
  category                model_category not null,
  status                  model_status not null default 'draft',
  is_new_face             boolean not null default false,
  instagram               text,
  published_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Внутренние заметки и контакты отдельно: публичный клиент их физически не видит.
create table model_private (
  model_id        uuid primary key references models(id) on delete cascade,
  internal_notes  text,
  phone           text,
  email           citext
);

create table model_translations (
  model_id         uuid not null references models(id) on delete cascade,
  locale           site_locale not null,
  display_name     text not null,
  bio              text,
  seo_title        text,
  seo_description  text,
  is_reviewed      boolean not null default false,  -- машинный перевод не публикуем без проверки
  primary key (model_id, locale)
);

-- История параметров: текущие = последняя запись по measured_at.
create table model_measurements (
  id           uuid primary key default gen_random_uuid(),
  model_id     uuid not null references models(id) on delete cascade,
  height_cm    numeric(4,1),
  bust_cm      numeric(4,1),
  waist_cm     numeric(4,1),
  hips_cm      numeric(4,1),
  shoe_eu      numeric(3,1),
  hair_color   text,
  eye_color    text,
  measured_at  date not null default current_date,
  created_by   uuid references staff(id),
  created_at   timestamptz not null default now()
);
create index on model_measurements (model_id, measured_at desc);

create view model_current_measurements with (security_invoker = true) as
  select distinct on (model_id) *
  from model_measurements
  order by model_id, measured_at desc, created_at desc;

create table model_representations (
  model_id   uuid not null references models(id) on delete cascade,
  office_id  uuid not null references offices(id) on delete cascade,
  kind       representation_kind not null default 'main',
  is_public  boolean not null default true,
  primary key (model_id, office_id)
);

create table model_media (
  id               uuid primary key default gen_random_uuid(),
  model_id         uuid not null references models(id) on delete cascade,
  kind             media_kind not null,
  bucket           text not null default 'models-public',
  storage_path     text not null,
  width            int,
  height           int,
  blurhash         text,
  alt              text,
  credits          text,                            -- фотограф, клиент, издание
  sort_order       int not null default 0,
  is_public        boolean not null default true,
  in_comp_card     boolean not null default false,
  rights_expire_at date,                            -- после даты снимаем с публикации
  created_at       timestamptz not null default now()
);
create index on model_media (model_id, kind, sort_order);

-- Кэш сгенерированных PDF: перегенерация, если data_hash изменился.
create table comp_cards (
  id                uuid primary key default gen_random_uuid(),
  model_id          uuid not null references models(id) on delete cascade,
  locale            site_locale not null,
  office_id         uuid references offices(id),
  template_version  int not null default 1,
  data_hash         text not null,
  storage_path      text not null,
  generated_by      uuid references staff(id),
  generated_at      timestamptz not null default now(),
  unique (model_id, locale, office_id, template_version, data_hash)
);

-- ---------------------------------------------------------------------------
-- Скаутинг
-- ---------------------------------------------------------------------------
create sequence scouting_ref_seq;

create table scouting_applications (
  id                uuid primary key default gen_random_uuid(),
  public_ref        text not null unique
                    default ('SA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('scouting_ref_seq')::text, 6, '0')),
  status            application_status not null default 'new',
  assigned_to       uuid references staff(id),
  office_id         uuid references offices(id),    -- желаемый рынок / офис-обработчик
  ui_locale         site_locale not null,            -- язык сайта
  contact_locale    text,                            -- язык общения, может отличаться
  full_name         text not null,
  email             citext not null,
  phone             text,
  instagram         text,
  birth_date        date,
  height_cm         numeric(4,1),
  country           text,
  city              text,
  is_minor          boolean not null default false,  -- ставит сервер по birth_date; отдельный процесс для несовершеннолетних
  source            text not null default 'website', -- website | wp_import | event ...
  landing_path      text,                            -- с какой страницы пришла заявка
  utm               jsonb not null default '{}',
  consent_version   text not null,
  consent_at        timestamptz not null default now(),
  ip_hash           text,                            -- для антиспама, не сырой IP
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on scouting_applications (status, created_at desc);
create index on scouting_applications (assigned_to);
create index on scouting_applications (office_id);

create table scouting_media (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references scouting_applications(id) on delete cascade,
  kind            scouting_photo_kind not null,
  storage_path    text not null,                    -- приватный bucket scouting
  mime_type       text not null,
  size_bytes      int not null,
  created_at      timestamptz not null default now()
);

-- История статусов и комментарии по заявке.
create table application_events (
  id              bigint generated always as identity primary key,
  application_id  uuid not null references scouting_applications(id) on delete cascade,
  actor_id        uuid references staff(id),
  from_status     application_status,
  to_status       application_status,
  note            text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Booking-запросы и shortlist (shortlist — этап B)
-- ---------------------------------------------------------------------------
create table booking_inquiries (
  id            uuid primary key default gen_random_uuid(),
  status        inquiry_status not null default 'new',
  assigned_to   uuid references staff(id),
  office_id     uuid references offices(id),
  company       text,
  contact_name  text not null,
  email         citext not null,
  phone         text,
  job_type      text,
  job_dates     text,
  location      text,
  message       text,
  ui_locale     site_locale not null,
  utm           jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create table booking_inquiry_models (
  inquiry_id  uuid not null references booking_inquiries(id) on delete cascade,
  model_id    uuid not null references models(id) on delete cascade,
  primary key (inquiry_id, model_id)
);

create table shortlists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Shortlist',
  share_token text unique,
  created_at  timestamptz not null default now()
);

create table shortlist_items (
  shortlist_id  uuid not null references shortlists(id) on delete cascade,
  model_id      uuid not null references models(id) on delete cascade,
  sort_order    int not null default 0,
  primary key (shortlist_id, model_id)
);

-- ---------------------------------------------------------------------------
-- SEO: старые URL WordPress -> новые пути (дополняет статический redirects.json)
-- ---------------------------------------------------------------------------
create table legacy_urls (
  old_path     text primary key,                   -- декодированный путь без домена, нижний регистр
  new_path     text,                               -- null + 410 = удалено
  status_code  smallint not null default 301 check (status_code in (301, 308, 410)),
  model_id     uuid references models(id) on delete set null,
  hits         bigint not null default 0,
  last_hit_at  timestamptz
);

-- ---------------------------------------------------------------------------
-- Очередь уведомлений (transactional outbox)
-- Заявка сохраняется всегда; Telegram получает её воркером с повторами.
-- ---------------------------------------------------------------------------
create table notification_outbox (
  id               bigint generated always as identity primary key,
  channel          text not null default 'telegram',
  event_type       text not null,                  -- scouting.created, booking.created ...
  entity_id        uuid not null,
  chat_id          bigint,                         -- null = общий чат из env
  payload          jsonb not null,
  status           notification_status not null default 'pending',
  attempts         int not null default 0,
  max_attempts     int not null default 8,
  next_attempt_at  timestamptz not null default now(),
  locked_at        timestamptz,
  last_error       text,
  sent_at          timestamptz,
  created_at       timestamptz not null default now(),
  unique (channel, event_type, entity_id, chat_id)
);
create index on notification_outbox (next_attempt_at) where status in ('pending', 'failed');

create or replace function enqueue_scouting_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification_outbox (event_type, entity_id, payload)
  values ('scouting.created', new.id, jsonb_build_object(
    'ref', new.public_ref, 'name', new.full_name, 'country', new.country,
    'city', new.city, 'height_cm', new.height_cm, 'locale', new.ui_locale))
  on conflict do nothing;
  return new;
end $$;

create trigger scouting_applications_notify
  after insert on scouting_applications
  for each row execute function enqueue_scouting_notification();

create or replace function enqueue_booking_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification_outbox (event_type, entity_id, payload)
  values ('booking.created', new.id, jsonb_build_object(
    'company', new.company, 'name', new.contact_name, 'job_type', new.job_type))
  on conflict do nothing;
  return new;
end $$;

create trigger booking_inquiries_notify
  after insert on booking_inquiries
  for each row execute function enqueue_booking_notification();

-- Воркер (Edge Function по pg_cron / Vercel Cron раз в минуту) забирает пачку без гонок.
create or replace function claim_notifications(batch_size int default 20)
returns setof notification_outbox
language sql security definer set search_path = public as $$
  update notification_outbox o
     set status = 'processing', locked_at = now(), attempts = o.attempts + 1
   where o.id in (
     select id from notification_outbox
      where (status in ('pending', 'failed') and next_attempt_at <= now())
         or (status = 'processing' and locked_at < now() - interval '5 minutes')
      order by next_attempt_at
      limit batch_size
      for update skip locked)
  returning o.*;
$$;

-- Итог отправки: успех или экспоненциальная пауза до следующей попытки.
create or replace function complete_notification(p_id bigint, p_ok boolean, p_error text default null)
returns void
language sql security definer set search_path = public as $$
  update notification_outbox
     set status = case when p_ok then 'sent'::notification_status
                       when attempts >= max_attempts then 'dead'::notification_status
                       else 'failed'::notification_status end,
         sent_at = case when p_ok then now() end,
         last_error = p_error,
         locked_at = null,
         next_attempt_at = now() + make_interval(secs => least(3600, 30 * power(2, attempts)))
   where id = p_id;
$$;

revoke all on function claim_notifications(int), complete_notification(bigint, boolean, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Хелперы ролей
-- ---------------------------------------------------------------------------
create or replace function current_role_app() returns app_role
language sql stable security definer set search_path = public as $$
  select role from staff where id = auth.uid() and is_active
$$;

create or replace function is_owner() returns boolean
language sql stable as $$ select coalesce(current_role_app() = 'owner', false) $$;

create or replace function in_my_offices(p_office uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_offices where staff_id = auth.uid() and office_id = p_office)
$$;

create or replace function model_in_my_offices(p_model uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from model_representations r
    join staff_offices s on s.office_id = r.office_id
    where r.model_id = p_model and s.staff_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table offices                enable row level security;
alter table office_translations    enable row level security;
alter table staff                  enable row level security;
alter table staff_offices          enable row level security;
alter table models                 enable row level security;
alter table model_private          enable row level security;
alter table model_translations     enable row level security;
alter table model_measurements     enable row level security;
alter table model_representations  enable row level security;
alter table model_media            enable row level security;
alter table comp_cards             enable row level security;
alter table scouting_applications  enable row level security;
alter table scouting_media         enable row level security;
alter table application_events     enable row level security;
alter table booking_inquiries      enable row level security;
alter table booking_inquiry_models enable row level security;
alter table shortlists             enable row level security;
alter table shortlist_items        enable row level security;
alter table legacy_urls            enable row level security;
alter table notification_outbox    enable row level security;  -- без политик: только service_role

-- Публичное чтение каталога
create policy offices_public_read on offices for select using (is_public or current_role_app() is not null);
create policy office_tr_public_read on office_translations for select using (true);
create policy models_public_read on models for select
  using (status = 'published' or current_role_app() is not null);
create policy model_tr_public_read on model_translations for select
  using (exists (select 1 from models m where m.id = model_id and m.status = 'published') or current_role_app() is not null);
create policy measurements_public_read on model_measurements for select
  using (exists (select 1 from models m where m.id = model_id and m.status = 'published') or current_role_app() is not null);
create policy representations_public_read on model_representations for select
  using ((is_public and exists (select 1 from models m where m.id = model_id and m.status = 'published')) or current_role_app() is not null);
create policy media_public_read on model_media for select
  using ((is_public and (rights_expire_at is null or rights_expire_at >= current_date)
          and exists (select 1 from models m where m.id = model_id and m.status = 'published'))
         or current_role_app() is not null);
create policy comp_cards_public_read on comp_cards for select
  using (exists (select 1 from models m where m.id = model_id and m.status = 'published') or current_role_app() is not null);
create policy legacy_urls_read on legacy_urls for select using (true);

-- Приватные данные модели: только персонал
create policy model_private_staff on model_private for select
  using (is_owner() or (current_role_app() = 'booker' and model_in_my_offices(model_id)));
create policy model_private_owner on model_private for all using (is_owner()) with check (is_owner());

-- Персонал
create policy staff_self_or_owner on staff for select using (id = auth.uid() or is_owner());
create policy staff_owner_write on staff for all using (is_owner()) with check (is_owner());
create policy staff_offices_read on staff_offices for select using (staff_id = auth.uid() or is_owner());
create policy staff_offices_owner on staff_offices for all using (is_owner()) with check (is_owner());

-- Справочники офисов редактирует только Owner
create policy offices_owner_write on offices for all using (is_owner()) with check (is_owner());
create policy office_tr_owner_write on office_translations for all using (is_owner()) with check (is_owner());

-- Модели: Owner — все; Booker — модели своих офисов; Scout — только чтение
create policy models_owner_all on models for all using (is_owner()) with check (is_owner());
create policy models_booker_update on models for update
  using (current_role_app() = 'booker' and model_in_my_offices(id))
  with check (current_role_app() = 'booker' and model_in_my_offices(id));

create policy model_tr_write on model_translations for all
  using (is_owner() or (current_role_app() = 'booker' and model_in_my_offices(model_id)))
  with check (is_owner() or (current_role_app() = 'booker' and model_in_my_offices(model_id)));
create policy measurements_write on model_measurements for all
  using (is_owner() or (current_role_app() = 'booker' and model_in_my_offices(model_id)))
  with check (is_owner() or (current_role_app() = 'booker' and model_in_my_offices(model_id)));
create policy media_write on model_media for all
  using (is_owner() or (current_role_app() = 'booker' and model_in_my_offices(model_id)))
  with check (is_owner() or (current_role_app() = 'booker' and model_in_my_offices(model_id)));
create policy representations_owner_write on model_representations for all using (is_owner()) with check (is_owner());
create policy comp_cards_staff_write on comp_cards for insert
  with check (is_owner() or (current_role_app() = 'booker' and model_in_my_offices(model_id)));

-- Скаутинг: Owner — все; Scout — назначенные ему или неназначенные в его офисах; Booker — нет доступа
create policy apps_owner_all on scouting_applications for all using (is_owner()) with check (is_owner());
create policy apps_scout_read on scouting_applications for select
  using (current_role_app() = 'scout'
         and (assigned_to = auth.uid() or (assigned_to is null and in_my_offices(office_id))));
create policy apps_scout_update on scouting_applications for update
  using (current_role_app() = 'scout'
         and (assigned_to = auth.uid() or (assigned_to is null and in_my_offices(office_id))))
  with check (current_role_app() = 'scout' and (assigned_to = auth.uid() or assigned_to is null));

create policy scouting_media_read on scouting_media for select
  using (exists (select 1 from scouting_applications a where a.id = application_id));  -- наследует RLS заявки
create policy app_events_read on application_events for select
  using (exists (select 1 from scouting_applications a where a.id = application_id));
create policy app_events_insert on application_events for insert
  with check (actor_id = auth.uid() and exists (select 1 from scouting_applications a where a.id = application_id));

-- Booking: Owner — все; Booker — своих офисов или назначенные; Scout — нет доступа
create policy inquiries_owner_all on booking_inquiries for all using (is_owner()) with check (is_owner());
create policy inquiries_booker on booking_inquiries for select
  using (current_role_app() = 'booker' and (assigned_to = auth.uid() or in_my_offices(office_id)));
create policy inquiries_booker_update on booking_inquiries for update
  using (current_role_app() = 'booker' and (assigned_to = auth.uid() or in_my_offices(office_id)))
  with check (current_role_app() = 'booker');
create policy inquiry_models_read on booking_inquiry_models for select
  using (exists (select 1 from booking_inquiries i where i.id = inquiry_id));

-- Shortlist принадлежит своему пользователю
create policy shortlists_own on shortlists for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy shortlist_items_own on shortlist_items for all
  using (exists (select 1 from shortlists s where s.id = shortlist_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from shortlists s where s.id = shortlist_id and s.owner_id = auth.uid()));

-- legacy_urls правит только Owner
create policy legacy_urls_owner on legacy_urls for all using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------------
-- Storage (buckets создаются в 0002): models-public — публичный, models-private,
-- comp-cards и scouting — приватные, отдаются по signed URL после проверки роли.
-- ---------------------------------------------------------------------------
