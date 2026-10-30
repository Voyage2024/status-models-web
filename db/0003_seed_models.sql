-- 0003: стартовый борд — 6 моделей со старого status-models.com (параметры сняты со страниц /kira_raab/ и т. д. 2026-10-28).
-- Идемпотентно: повторный запуск обновляет имена и параметры, а не плодит дубли.
-- Фото здесь не заводятся: их загружает scripts/upload-model-photos.mjs (сам узнаёт размеры и пишет model_media).
--
-- slug совпадают со старыми URL WordPress (/anastasiia_prokhorova/ → /en/models/anastasiia-prokhorova),
-- менять их нельзя, иначе 301 из lib/seo/legacy-redirects.ts поведут в 404.

begin;

create temp table seed_models (
  code text, slug text, first_name text, last_name text, name_ru text,
  height numeric, bust numeric, waist numeric, hips numeric, hair text, eyes text,
  old_en text, old_ru text
) on commit drop;

insert into seed_models values
  ('SI-0001', 'anastasiia-prokhorova', 'Anastasiia', 'Prokhorova', 'Анастасия Прохорова', 164, 82, 60, 88, 'Light brown', 'Brown',     '/anastasiia_prokhorova/', '/ru/анастасия_прохорова/'),
  ('SI-0002', 'celine-farah',          'Celine',     'Farah',      'Селина Фарах',        162, 80, 62, 90, 'Dark brown',  'Brown',     '/celine_farah/',          '/ru/селина_фарах/'),
  ('SI-0003', 'ekaterina-tronova',     'Ekaterina',  'Tronova',    'Екатерина Тронова',   173, 95, 63, 95, 'Light brown', 'Grey',      '/ekaterina_tronova/',     '/ru/екатерина_тронова/'),
  ('SI-0004', 'kashish-kushal',        'Kashish',    'Kushal',     'Кашиш Кушал',         150, 84, 60, 90, 'Dark brown',  'Brown',     '/kashish_kushal/',        '/ru/kashish_kushal_rus/'),
  ('SI-0005', 'kira-raab',             'Kira',       'Raab',       'Кира Рааб',           165, 72, 60, 82, 'Dark brown',  'Grey-blue', '/kira_raab/',             '/ru/кира_рааб/'),
  ('SI-0006', 'marina-gerasimova',     'Marina',     'Gerasimova', 'Марина Герасимова',   167, 82, 58, 92, 'Long red',    'Blue',      '/marina_gerasimova/',     '/ru/марина_герасимова/');

insert into models (internal_code, slug, first_name, last_name, category, status, published_at)
select code, slug, first_name, last_name, 'women', 'published', now() from seed_models
on conflict (slug) do update
  set first_name   = excluded.first_name,
      last_name    = excluded.last_name,
      status       = 'published',
      published_at = coalesce(models.published_at, excluded.published_at),
      updated_at   = now();

-- Имена на en и ru проверены вручную; es/pt страницы берут английский вариант.
insert into model_translations (model_id, locale, display_name, is_reviewed)
select m.id, 'en'::site_locale, s.first_name || ' ' || s.last_name, true from seed_models s join models m using (slug)
union all
select m.id, 'ru'::site_locale, s.name_ru, true from seed_models s join models m using (slug)
on conflict (model_id, locale) do update set display_name = excluded.display_name, is_reviewed = true;

-- Параметры на дату переноса: запись этой даты заменяется, более поздние замеры из админки не трогаем.
delete from model_measurements x
using seed_models s join models m using (slug)
where x.model_id = m.id and x.measured_at = date '2026-10-28';

insert into model_measurements (model_id, height_cm, bust_cm, waist_cm, hips_cm, hair_color, eye_color, measured_at)
select m.id, s.height, s.bust, s.waist, s.hips, s.hair, s.eyes, date '2026-10-28'
from seed_models s join models m using (slug);

-- Старые URL моделей → модель (для отчётов по миграции; сами 301 отдаёт middleware).
insert into legacy_urls (old_path, new_path, model_id)
select s.old_en, '/en/models/' || s.slug, m.id from seed_models s join models m using (slug)
union all
select s.old_ru, '/ru/models/' || s.slug, m.id from seed_models s join models m using (slug)
on conflict (old_path) do update set new_path = excluded.new_path, model_id = excluded.model_id;

commit;
