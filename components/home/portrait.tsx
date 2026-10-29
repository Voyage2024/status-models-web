import Image from "next/image";
import type { TalentCard } from "@/lib/data/types";

/** Портрет модели 3:4. Без фото показывает графитовую монограмму, чтобы сетка не разваливалась. */
export function Portrait({
  talent,
  sizes,
  priority = false,
  className = "",
}: {
  talent: TalentCard;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const initials = talent.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

  return (
    <div className={`grain relative aspect-[3/4] overflow-hidden bg-graphite ${className}`}>
      {talent.cover ? (
        <Image
          src={talent.cover.src}
          alt={talent.cover.alt || talent.name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover grayscale-[35%] transition-[transform,filter] duration-[1400ms] ease-luxe group-hover:scale-[1.04] group-hover:grayscale-0"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_80%_at_50%_20%,#232323_0%,#121212_55%,#0b0b0b_100%)]"
        >
          <span className="display text-[clamp(4rem,9vw,8rem)] italic text-white/[0.06]">{initials}</span>
        </div>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/80 to-transparent" />
    </div>
  );
}
