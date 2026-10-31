"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition, type MouseEvent } from "react";
import { LOCALE_COOKIE, locales, type Locale } from "@/lib/i18n/config";
import { switchLocalePath } from "@/lib/i18n/paths";

// Смена языка клиентским переходом: страница не перезагружается, прокрутка остаётся на месте,
// старый язык виден до готовности нового (transition), а выбранный подсвечивается сразу.
// href у ссылок настоящий: hreflang-ссылки видны поисковикам, открытие в новой вкладке работает.
export function LocaleSwitcher({ current, label, className = "" }: { current: Locale; label: string; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useOptimistic(current);

  function select(e: MouseEvent<HTMLAnchorElement>, target: Locale) {
    // Ctrl/Cmd/Shift-клик и средняя кнопка: пусть браузер откроет ссылку как обычно.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (target === active) return;
    // usePathname не знает про ?query и #hash (например ?source=scout в форме скаутинга): берём их из location.
    const url = switchLocalePath(pathname, target) + window.location.search + window.location.hash;
    // Страница могла прийти из prefetch без запроса к серверу, и middleware не обновит cookie: пишем её сами.
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => {
      setActive(target);
      router.push(url, { scroll: false });
    });
  }

  return (
    <nav aria-label={label} aria-busy={pending || undefined} className={`items-center gap-3 ${className}`}>
      {locales.map((l) => (
        <Link
          key={l}
          href={switchLocalePath(pathname, l)}
          hrefLang={l}
          scroll={false}
          onClick={(e) => select(e, l)}
          aria-current={l === active ? "true" : undefined}
          className={`eyebrow transition-colors duration-300 ${l === active ? "text-champagne" : "text-mist hover:text-bone"}`}
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
