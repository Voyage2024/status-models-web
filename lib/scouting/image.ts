"use client";

/**
 * Сжимает снимок в браузере: длинная сторона до 2000 px, JPEG 0.86.
 * Перерисовка через canvas заодно убирает EXIF, включая геолокацию из телефона.
 * Если браузер не смог декодировать файл, отдаёт оригинал: сервер всё равно проверит тип и размер.
 */
export async function compressPhoto(file: File, maxSide = 2000, quality = 0.86): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
