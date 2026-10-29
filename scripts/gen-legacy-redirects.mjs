// Генерирует lib/seo/legacy-redirects.ts из аудита URL старого WordPress.
// Запуск: node scripts/gen-legacy-redirects.mjs ../audit/url-inventory.csv
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2] ?? "../audit/url-inventory.csv";
const [header, ...lines] = readFileSync(src, "utf8").trim().split(/\r?\n/);
const cols = header.split(",");
const idx = (name) => cols.indexOf(name);

const redirects = {};
const gone = [];
const skipped = [];

for (const line of lines) {
  const cells = line.split(",");
  const path = cells[idx("decoded_path")];
  const target = cells[idx("proposed_new_url")];
  const action = cells[idx("action")];
  if (action === "301" && target && target !== "?") redirects[path] = target;
  else if (action === "410") gone.push(path);
  else skipped.push(`${path} (${action})`);
}

// "/" не кладём в карту: корень обрабатывает выбор языка в middleware.
delete redirects["/"];

const out = `// Сгенерировано scripts/gen-legacy-redirects.mjs из audit/url-inventory.csv. Не править руками.
// Ключи: декодированный путь старого WordPress со слешем на конце.
export const legacyRedirects: Record<string, string> = ${JSON.stringify(redirects, null, 2)};

export const legacyGone: ReadonlySet<string> = new Set(${JSON.stringify(gone, null, 2)});
`;
writeFileSync(new URL("../lib/seo/legacy-redirects.ts", import.meta.url), out);
console.log(`301: ${Object.keys(redirects).length}, 410: ${gone.length}`);
if (skipped.length) console.log("Пропущены (нужна проверка):", skipped.join("; "));
