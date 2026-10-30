-- 0004: админка /[locale]/admin. Запускать после 0001–0003, повторный запуск безопасен.
-- Права остаются в RLS из 0001 (owner — всё, booker — модели своих офисов, scout — только чтение):
-- админка ходит в базу с JWT сотрудника, а service_role берёт только для подписи загрузок в Storage.

begin;

-- Внутренний код модели выдаёт база: SI-0007, SI-0008 … (сид занял SI-0001…SI-0006).
create sequence if not exists model_code_seq;
select setval('model_code_seq',
  greatest(1, coalesce((select max(substring(internal_code from '^SI-(\d+)$')::int) from models), 0)),
  exists (select 1 from models where internal_code ~ '^SI-\d+$'));
alter table models alter column internal_code set default ('SI-' || lpad(nextval('model_code_seq')::text, 4, '0'));

-- updated_at сам обновляется при любой правке модели: по нему страница и Comp Card понимают, что данные свежие.
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists models_set_updated_at on models;
create trigger models_set_updated_at before update on models
  for each row execute function set_updated_at();

-- Замер на одну дату — одна запись: повторное сохранение параметров в тот же день правит её, а не плодит историю.
-- Если в базе уже есть дубли за день, оставляем самый свежий.
delete from model_measurements a using model_measurements b
 where a.model_id = b.model_id and a.measured_at = b.measured_at and a.created_at < b.created_at;
create unique index if not exists model_measurements_model_day on model_measurements (model_id, measured_at);

commit;

-- ---------------------------------------------------------------------------
-- Первый Owner (один раз, руками):
-- 1. Supabase → Authentication → Users → Add user → Create new user (email + пароль, Auto Confirm User).
-- 2. Выполнить, подставив свой email и имя:
--
-- insert into staff (id, role, full_name)
-- select id, 'owner', 'Имя Фамилия' from auth.users where email = 'you@example.com'
-- on conflict (id) do update set role = excluded.role, is_active = true;
--
-- Букеров и скаутов заводит Owner так же (role 'booker' / 'scout'), а офисы им даёт через staff_offices:
-- insert into staff_offices (staff_id, office_id)
-- select s.id, o.id from staff s, offices o where s.full_name = 'Имя Букера' and o.slug = 'paris';
-- ---------------------------------------------------------------------------
