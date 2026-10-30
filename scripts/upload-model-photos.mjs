// Загрузка фото моделей в Supabase Storage (bucket models-public) и запись в model_media.
//
//   node --env-file=.env.local scripts/upload-model-photos.mjs ./photos
//
// Структура папки: photos/<slug>/<NN>-<kind>[-cc].jpg, например
//   photos/kira-raab/01-cover.jpg        обложка (на борде и лицевой стороне Comp Card)
//   photos/kira-raab/02-portfolio-cc.jpg портфолио, -cc = попадает на оборот Comp Card
//   photos/kira-raab/20-digitals.jpg     диджиталы (снепы без макияжа)
// NN — порядок вывода, kind: cover | portfolio | editorial | campaign | digitals (без kind → portfolio).
// Повторный запуск перезаливает файл и обновляет строку, дублей не будет.
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const KINDS = new Set(["cover", "portfolio", "editorial", "campaign", "digitals"]);
const BUCKET = "models-public";

const root = process.argv[2];
if (!root) {
  console.error("Usage: node --env-file=.env.local scripts/upload-model-photos.mjs <photos-dir>");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Ширина и высота из заголовка JPEG/PNG, без зависимостей. */
function imageSize(buf) {
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      // SOF0..SOF15, кроме DHT (C4), JPG (C8) и DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function parseName(file) {
  const base = path.parse(file).name.toLowerCase();
  const parts = base.split("-");
  const order = /^\d+$/.test(parts[0]) ? Number(parts.shift()) : 0;
  const inCompCard = parts.at(-1) === "cc" ? (parts.pop(), true) : false;
  const kind = KINDS.has(parts[0]) ? parts[0] : "portfolio";
  return { order, kind, inCompCard: inCompCard || kind === "cover" };
}

const contentType = (f) => (/\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg");

let ok = 0;
for (const slug of (await fs.readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const { data: model, error } = await supabase.from("models").select("id, first_name, last_name").eq("slug", slug).maybeSingle();
  if (error || !model) {
    console.warn(`⚠ ${slug}: модели с таким slug нет в базе, пропускаю`);
    continue;
  }
  const files = (await fs.readdir(path.join(root, slug))).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  for (const file of files) {
    const buf = await fs.readFile(path.join(root, slug, file));
    const size = imageSize(buf);
    const { order, kind, inCompCard } = parseName(file);
    const storagePath = `${slug}/${file.toLowerCase()}`;

    const up = await supabase.storage.from(BUCKET).upload(storagePath, buf, { contentType: contentType(file), upsert: true, cacheControl: "31536000" });
    if (up.error) {
      console.error(`✗ ${storagePath}: ${up.error.message}`);
      continue;
    }
    await supabase.from("model_media").delete().eq("model_id", model.id).eq("storage_path", storagePath);
    const ins = await supabase.from("model_media").insert({
      model_id: model.id,
      kind,
      bucket: BUCKET,
      storage_path: storagePath,
      width: size?.width ?? null,
      height: size?.height ?? null,
      alt: [model.first_name, model.last_name].filter(Boolean).join(" "),
      sort_order: order,
      in_comp_card: inCompCard,
    });
    if (ins.error) console.error(`✗ ${storagePath}: ${ins.error.message}`);
    else {
      ok++;
      console.log(`✓ ${storagePath} (${kind}, ${size ? `${size.width}×${size.height}` : "размер ?"})`);
    }
  }
}
console.log(`Готово: ${ok} фото. Страницы обновятся в течение 5 минут (ISR).`);
