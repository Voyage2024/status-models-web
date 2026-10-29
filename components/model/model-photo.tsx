import Image from "next/image";
import type { ModelMedia } from "@/lib/data/model";

/** Фото портфолио в родных пропорциях (если размеры известны), иначе 3:4. */
export function ModelPhoto({ photo, sizes, priority = false }: { photo: ModelMedia; sizes: string; priority?: boolean }) {
  const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : "3 / 4";
  return (
    <figure className="group">
      <div className="grain relative overflow-hidden bg-graphite" style={{ aspectRatio: ratio }}>
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-[1400ms] ease-luxe group-hover:scale-[1.02]"
        />
      </div>
      {photo.credits && <figcaption className="eyebrow mt-3 text-[0.625rem] text-mist">{photo.credits}</figcaption>}
    </figure>
  );
}
