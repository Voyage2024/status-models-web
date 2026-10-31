-- 0002: Storage buckets (черновик, к 0001_init.sql).
-- Политик на storage.objects для anon/authenticated здесь нет намеренно:
--   * models-public читается по публичному URL (bucket public = true), пишет только сервер (service_role);
--   * scouting, models-private, comp-cards приватные: загрузка анкет идёт по signed upload URL,
--     который выдаёт server action (lib/scouting/actions.ts), чтение — по signed URL после проверки роли.
-- Лимиты типа и размера проверяет сам Storage, ещё до нашего кода.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('models-public',  'models-public',  true,  20 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4']),
  ('models-private', 'models-private', false, 20 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('comp-cards',     'comp-cards',     false, 15 * 1024 * 1024, array['application/pdf']),
  ('scouting',       'scouting',       false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
