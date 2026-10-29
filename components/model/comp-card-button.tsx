import type { Locale } from "@/lib/i18n/config";
import { href } from "@/lib/i18n/paths";

/** Обычная ссылка, а не клиентский fetch: PDF собирает route handler, браузер просто скачивает файл. */
export function CompCardButton({ locale, slug, label, hint }: { locale: Locale; slug: string; label: string; hint: string }) {
  return (
    <a
      href={href(locale, `/models/${slug}/comp-card`)}
      download={`${slug}-comp-card-${locale}.pdf`}
      className="group flex items-center justify-between gap-6 border border-champagne/60 px-6 py-5 text-bone transition-colors duration-500 ease-luxe hover:bg-champagne hover:text-ink"
    >
      <span>
        <span className="eyebrow block">{label}</span>
        <span className="mt-1.5 block text-xs text-mist transition-colors group-hover:text-ink/70">{hint}</span>
      </span>
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M12 4v12m0 0-5-5m5 5 5-5M5 20h14" />
      </svg>
    </a>
  );
}
