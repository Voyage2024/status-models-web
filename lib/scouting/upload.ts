"use client";

/**
 * Загрузка по подписанному URL из createSignedUploadUrl. Тот же запрос, что делает
 * supabase-js uploadToSignedUrl, но без клиентской библиотеки в бандле формы.
 * Шлюз Supabase требует apikey даже здесь; права даёт только token, привязанный к пути.
 */
export async function uploadToSignedUrl(bucket: string, path: string, token: string, blob: Blob) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const res = await fetch(url, {
    method: "PUT",
    body: blob,
    headers: {
      apikey: anon,
      authorization: `Bearer ${anon}`,
      "content-type": blob.type || "image/jpeg",
      "cache-control": "max-age=3600",
      "x-upsert": "false",
    },
  });
  if (!res.ok) throw new Error(`upload ${res.status}`);
}
