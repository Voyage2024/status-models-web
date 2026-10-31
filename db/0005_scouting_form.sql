-- 0005: полная анкета скаутинга. Запускать после 0001–0004, повторный запуск безопасен.
-- Таблица scouting_applications, scouting_media, очередь notification_outbox и триггер уведомления
-- уже есть в 0001_init.sql: здесь только то, чего не хватало форме.

begin;

-- Статус новой заявки: pending вместо new (переименование, не второе значение — данные переедут сами).
do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'application_status' and e.enumlabel = 'new') then
    alter type application_status rename value 'new' to 'pending';
  end if;
end $$;
alter table scouting_applications alter column status set default 'pending';

-- Имя и фамилия раздельно; full_name остаётся (его пишет сервер), на нём держатся поиск и уведомления.
alter table scouting_applications
  add column if not exists first_name  text,
  add column if not exists last_name   text,
  add column if not exists telegram    text,                -- username без @
  add column if not exists bust_cm     smallint,
  add column if not exists waist_cm    smallint,
  add column if not exists hips_cm     smallint,
  add column if not exists eye_color   text,                -- по-английски, как в model_measurements
  add column if not exists hair_color  text,
  add column if not exists shoe_eu     numeric(3,1);

alter table scouting_applications drop constraint if exists scouting_applications_params_check;
alter table scouting_applications add constraint scouting_applications_params_check check (
  (bust_cm  is null or bust_cm  between 60 and 140) and
  (waist_cm is null or waist_cm between 45 and 110) and
  (hips_cm  is null or hips_cm  between 60 and 140) and
  (shoe_eu  is null or shoe_eu  between 33 and 48)
);

create index if not exists scouting_applications_created_idx on scouting_applications (created_at desc);

-- Booker получает заявки так же, как Scout: назначенные ему и неназначенные в его офисах.
-- В 0001 у букера доступа не было, но уведомления в Telegram идут и букерам — кнопка «Открыть в админке» должна работать.
drop policy if exists apps_booker_read on scouting_applications;
create policy apps_booker_read on scouting_applications for select
  using (current_role_app() = 'booker'
         and (assigned_to = auth.uid() or (assigned_to is null and in_my_offices(office_id))));
drop policy if exists apps_booker_update on scouting_applications;
create policy apps_booker_update on scouting_applications for update
  using (current_role_app() = 'booker'
         and (assigned_to = auth.uid() or (assigned_to is null and in_my_offices(office_id))))
  with check (current_role_app() = 'booker' and (assigned_to = auth.uid() or assigned_to is null));

-- Триггер scouting_applications_notify из 0001 не меняется: payload короткий, полную анкету
-- с фото воркер дочитывает из таблицы в момент отправки (lib/notifications/scouting.ts).

commit;

-- Фото анкет лежат в приватном bucket `scouting` (0002_storage.sql) в папке
-- scouting-applications/<id заявки>/portrait.jpg, profile.jpg, full_length.jpg, extra_1.jpg, extra_2.jpg.
